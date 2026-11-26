/**
 * Adds a MARATHI twin for every English question, so each question exists in both languages.
 *
 *  - English questions are NEVER modified or deleted: Marathi questions are inserted as NEW
 *    documents (language "mr", translatedFrom = English _id, sourceKey "tr-mr:<englishId>").
 *  - Idempotent: re-running skips questions that already have a twin; safe to stop/resume.
 *  - Each translation is validated (same options, same correct key, Devanagari present, numbers
 *    preserved); a failed one is skipped and reported, never inserted.
 *  - A (test, category, subject) group that already has real Marathi questions (>= 90% of the
 *    English count, e.g. from the Marathi Excel books) is skipped, unless --force-groups.
 *
 *  ANTHROPIC_API_KEY=... npx tsx scripts/translate-questions.ts --dry-run --limit 20
 *  ANTHROPIC_API_KEY=... npx tsx scripts/translate-questions.ts            # everything
 *  Options: --test <testId>  --limit N  --batch N (default 10)  --force-groups  --dry-run
 *  Optional env: TRANSLATE_MODEL (default claude-sonnet-5-5)
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Test } from "../src/models/Test";
import { Question, type IQuestion } from "../src/models/Question";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const val = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const DRY = flag("dry-run");
const BATCH = Number(val("batch") ?? 10);
const LIMIT = Number(val("limit") ?? Infinity);
const MODEL = process.env.TRANSLATE_MODEL || "claude-sonnet-5-5";
const KEY = process.env.ANTHROPIC_API_KEY;
const DEVANAGARI = /[ऀ-ॿ]/;

const SYSTEM = `You translate school exam questions (Maharashtra State Board, classes 5-12) from English to Marathi.
Rules:
- Natural, textbook-standard Marathi (as in Balbharati books). Use standard Marathi scientific/maths terms.
- Keep numbers, math symbols, formulas, chemical formulae, units, variable names (x, y, a, b), code, URLs and proper nouns exactly as they are. Digits stay as written in the source (do not convert).
- Keep widely used technical terms of AI/IT (e.g. "AI", "CPU", "Wi-Fi", "URL") in English or as Marathi with the English in brackets only if the source does so.
- Do NOT answer, shorten, add hints or reorder. Options keep their keys (A, B, C, D) and order.
- If an option is only a number/formula/symbol, return it unchanged.
Return ONLY a JSON array, one object per input: {"id": string, "text": string, "options": {"A": string, ...}, "explanation": string|null}.`;

type Tr = { id: string; text: string; options: Record<string, string>; explanation: string | null };

async function callModel(items: object[], attempt = 1): Promise<Tr[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages: [{ role: "user", content: JSON.stringify(items) }] }),
  });
  if (!res.ok) {
    if (attempt < 5 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return callModel(items, attempt + 1);
    }
    throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const j = (await res.json()) as { content: { type: string; text?: string }[] };
  const raw = j.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("model returned no JSON array");
  return JSON.parse(m[0]) as Tr[];
}

const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join("|");

/** Returns an error string, or null when the translation is acceptable. */
export function validate(src: IQuestion, t: Tr | undefined): string | null {
  if (!t) return "missing from response";
  if (!t.text?.trim()) return "empty text";
  const srcHasLetters = /[A-Za-z]{3,}/.test(src.text);
  if (srcHasLetters && !DEVANAGARI.test(t.text)) return "question text has no Devanagari";
  if (t.text.length > 5000) return "text too long";
  if (nums(src.text) !== nums(t.text)) return "numbers in text differ";
  for (const o of src.options) {
    const to = t.options?.[o.key];
    if (!to?.trim()) return `option ${o.key} missing`;
    if (to.length > 1000) return `option ${o.key} too long`;
    if (nums(o.text) !== nums(to)) return `numbers differ in option ${o.key}`;
  }
  if (Object.keys(t.options ?? {}).length !== src.options.length) return "option count differs";
  return null;
}

(async () => {
  if (!DRY && !KEY) throw new Error("Set ANTHROPIC_API_KEY (or use --dry-run to only count).");
  if (DRY && !KEY) console.log("(dry run without API key: counting only)");
  await connectDB();

  const testFilter: Record<string, unknown> = { languages: "mr" };
  if (val("test")) testFilter._id = val("test");
  const tests = await Test.find(testFilter).select("name").lean();
  console.log(`${tests.length} test(s) that offer Marathi`);

  let done = 0, failed = 0, skipped = 0, inserted = 0;
  const problems: string[] = [];

  for (const t of tests) {
    const all = await Question.find({ test: t._id, isActive: true }).lean();
    const en = all.filter((q) => (q.language ?? "en") === "en" && !q.translatedFrom);
    const mr = all.filter((q) => q.language === "mr");
    const twinOf = new Set(mr.map((q) => String(q.translatedFrom ?? "")).filter(Boolean));
    const twinKeys = new Set(mr.map((q) => q.sourceKey).filter(Boolean));

    // group = category|subject ; skip groups already covered by real Marathi books
    const groupKey = (q: IQuestion) => `${q.category}|${q.subject ?? ""}`;
    const enBy = new Map<string, number>(), mrBy = new Map<string, number>();
    en.forEach((q) => enBy.set(groupKey(q), (enBy.get(groupKey(q)) ?? 0) + 1));
    mr.filter((q) => !q.translatedFrom).forEach((q) => mrBy.set(groupKey(q), (mrBy.get(groupKey(q)) ?? 0) + 1));
    const covered = (q: IQuestion) => !flag("force-groups") && (mrBy.get(groupKey(q)) ?? 0) >= 0.9 * (enBy.get(groupKey(q)) ?? 1);

    const todo = en.filter((q) => !twinOf.has(String(q._id)) && !twinKeys.has(`tr-mr:${q._id}`) && !covered(q));
    skipped += en.length - todo.length;
    console.log(`\n${t.name}: ${en.length} English, ${mr.length} Marathi, to translate: ${todo.length}`);
    if (DRY && !KEY) continue;

    for (let i = 0; i < todo.length && done < LIMIT; i += BATCH) {
      const chunk = todo.slice(i, i + Math.min(BATCH, LIMIT - done));
      let out: Tr[];
      try {
        out = await callModel(chunk.map((q) => ({
          id: String(q._id), text: q.text,
          options: Object.fromEntries(q.options.map((o) => [o.key, o.text])), explanation: q.explanation ?? null,
        })));
      } catch (e) {
        failed += chunk.length; problems.push(`batch @${i}: ${(e as Error).message}`); console.log("  batch failed:", (e as Error).message); continue;
      }
      const byId = new Map(out.map((o) => [String(o.id), o]));
      const docs = [];
      for (const q of chunk) {
        const tr = byId.get(String(q._id));
        const err = validate(q as IQuestion, tr);
        if (err || !tr) { failed++; problems.push(`${q._id}: ${err}`); continue; }
        docs.push({
          center: q.center, test: q.test, createdBy: q.createdBy,
          text: tr.text.trim(),
          options: q.options.map((o) => ({ key: o.key, text: tr.options[o.key]!.trim(), imageUrl: o.imageUrl ?? null })),
          correctOption: q.correctOption, difficulty: q.difficulty, class: q.class, classGroup: q.classGroup ?? null,
          category: q.category, stream: q.stream ?? null, streams: q.streams ?? [],
          explanation: q.explanation ? (tr.explanation?.trim() || null) : null,
          imageUrl: q.imageUrl ?? null, subject: q.subject ?? null, chapter: q.chapter ?? null,
          language: "mr" as const, translatedFrom: q._id, sourceKey: `tr-mr:${q._id}`,
          fromLibrary: q.fromLibrary ?? false, isActive: true,
        });
      }
      done += chunk.length;
      if (docs.length && !DRY) { await Question.insertMany(docs, { ordered: false }); inserted += docs.length; }
      else inserted += docs.length;
      console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}  ok=${docs.length} failed=${chunk.length - docs.length}${DRY ? " (dry)" : ""}`);
    }
  }
  console.log(`\nInserted ${inserted}${DRY ? " (dry run, nothing written)" : ""}, failed ${failed}, already-covered/skipped ${skipped}`);
  if (problems.length) console.log("Problems (re-run to retry these):\n  " + problems.slice(0, 50).join("\n  "));
  await mongoose.disconnect();
})();
