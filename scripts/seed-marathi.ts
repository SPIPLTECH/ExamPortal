/**
 * NON-DESTRUCTIVE: adds the MARATHI questions (from scripts/seed-data, the same Excel files the
 * full seed uses) to the tests that ALREADY exist in the database.
 *
 *  - Nothing is deleted. English questions, tests, students, attempts and results are not touched.
 *  - Marathi questions are inserted as new documents (language "mr"); re-running is safe
 *    (already-present ones are skipped by sourceKey).
 *  - A test that has no languages/blueprint yet gets ["en","mr"] + the standard blueprint, so the
 *    language picker works. Existing blueprints are kept (class 11/12 syllabus slices only get the
 *    English fallback, because no Marathi syllabus book exists for 11/12).
 *  - Untagged (legacy) English questions of these tests are treated as English by the exam engine.
 *
 *  npx tsx scripts/seed-marathi.ts --dry-run          # show what would be added
 *  npx tsx scripts/seed-marathi.ts                    # do it (uses MONGODB_URI from .env)
 *  Options: --all-tests (also hand-made tests)  --center "Soft Polynomials"  (default: every center)   --test <testId>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectAndSyncIndexes } from "../src/lib/db";
import { ALCCenter } from "../src/models/ALCCenter";
import { Question } from "../src/models/Question";
import { Test, type IBlueprintEntry } from "../src/models/Test";
import { sources, parseSource, blueprintFor, uploadAll } from "./seed-exams";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const val = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

(async () => {
  const mr = sources().filter((s) => s.language === "mr");
  console.log("Parsing Marathi Excel files…");
  const parsed = [];
  for (const s of mr) parsed.push(...(await parseSource(s)));
  console.log(`  ${mr.length} sheets, ${parsed.length} Marathi questions`);

  const imageFiles = [...new Set(parsed.map((p) => p.imageFile).filter((x): x is string => !!x))];
  const urlByFile = await uploadAll(imageFiles, DRY);

  await connectAndSyncIndexes();
  const filter: Record<string, unknown> = { targetClass: { $gte: 5, $lte: 12 } };
  if (val("test")) filter._id = val("test");
  if (val("center")) {
    const c = await ALCCenter.findOne({ name: { $regex: `^\\s*${val("center")!.replace(/\s+/g, "\\s+")}\\s*$`, $options: "i" } }).select("_id").lean();
    if (!c) throw new Error(`Center "${val("center")}" not found`);
    filter.center = c._id;
  }
  const allTests = await Test.find(filter);
  // Only tests that were built by the seed (their English pool carries seed keys "5|ALL|en|...").
  // Tests made by hand in the ALC panel (single-language teacher tests, Marathi-named tests, demos)
  // are left alone unless --all-tests is given.
  const SEED_EN = /^\d+\|(ALL|SCIENCE|COMMERCE|ARTS)\|en\|/;
  const tests: typeof allTests = [];
  const skippedManual: typeof allTests = [];
  for (const t of allTests) {
    const seeded = args.includes("--all-tests") || (await Question.exists({ test: t._id, sourceKey: SEED_EN }));
    (seeded ? tests : skippedManual).push(t);
  }
  console.log(`${allTests.length} test(s) found: ${tests.length} seeded (will be handled), ${skippedManual.length} custom (left untouched)`);
  skippedManual.forEach((t) => console.log(`  skip (custom test): ${t.name}`));

  let added = 0;
  for (const test of tests) {
    const cls = test.targetClass as number;
    const stream = test.targetStream ?? null;
    const base = blueprintFor(cls);
    const mine = parsed.filter((p) => p.src.cls === cls && (!stream || !p.src.streams.length || p.src.streams.includes(stream)));
    if (!mine.length) { console.log(`- ${test.name}: no Marathi sheets for class ${cls}`); continue; }

    // Existing Marathi questions are matched by sourceKey AND by exact text, because older seeds
    // used a different key format: this guarantees no Marathi question is ever added twice.
    const existingMr = await Question.find({ test: test._id, language: "mr" }).select("sourceKey text").lean();
    const have = new Set(existingMr.map((q) => q.sourceKey));
    const haveText = new Set(existingMr.map((q) => q.text.trim()));
    const docs = mine
      .map((p) => ({
        center: test.center, test: test._id, createdBy: test.createdBy,
        text: p.text, options: p.options, correctOption: p.correct, difficulty: p.difficulty,
        class: cls, classGroup: p.src.group, category: p.src.category, stream: null, streams: p.src.streams,
        subject: p.src.subject, chapter: p.chapter || null, language: "mr" as const,
        imageUrl: p.imageFile ? urlByFile.get(p.imageFile) ?? null : null,
        sourceKey: `${cls}|${stream ?? "ALL"}|mr|${p.src.group}|${p.qno}`, isActive: true,
      }))
      .filter((d) => !have.has(d.sourceKey) && !haveText.has(d.text.trim()));

    // test settings: only ADD what is missing
    const upd: Record<string, unknown> = {};
    const langs = new Set<string>(test.languages ?? []);
    if (!langs.has("mr") || !langs.has("en")) upd.languages = ["en", "mr"];
    if (!test.blueprint?.length) {
      upd.blueprint = stream
        ? base.blueprint.filter((b) => !b.streams?.length || b.streams.includes(stream)).map((b) => ({ ...b, streams: [] }))
        : base.blueprint;
    } else if (cls >= 11) {
      const bp = test.blueprint.map((b) => (b.category === "SYLLABUS" && !b.fallbackLanguage ? { ...(b as unknown as { toObject?: () => object }).toObject?.() ?? b, fallbackLanguage: "en" } : b));
      if (bp.some((b, i) => b !== test.blueprint![i])) upd.blueprint = bp as unknown as IBlueprintEntry[];
    }

    console.log(`- ${test.name}: +${docs.length} Marathi questions (${existingMr.length} already there)${Object.keys(upd).length ? `; test update: ${Object.keys(upd).join(", ")}` : ""}`);
    if (DRY) { added += docs.length; continue; }
    for (let i = 0; i < docs.length; i += 500) await Question.insertMany(docs.slice(i, i + 500), { ordered: false });
    if (Object.keys(upd).length) await Test.updateOne({ _id: test._id }, { $set: upd });
    added += docs.length;
  }
  console.log(`\n${DRY ? "Would add" : "Added"} ${added} Marathi questions. Nothing was deleted.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
