/**
 * Builds the complete Class 5–12 exam setup for the "Soft Polynomials" ALC
 * center from the Excel files + images in scripts/seed-data. Called from
 * scripts/seed.ts (or run directly: `npm run seed:exams`).
 *
 *  1. finds / creates the Soft Polynomials center
 *  2. removes that center's previous questions and tests
 *  3. uploads every question image to Cloudinary (deduplicated by content hash)
 *  4. creates one test per class ("Class 5th Test" … "Class 12th Test") whose
 *     own question pool holds every question, tagged with language/subject/stream
 *  5. gives each test a blueprint so every student gets 25 RANDOM questions in
 *     the exact subject split, in the language they choose at exam start
 *
 * Flags / env:
 *   --dry-run            parse + validate everything, touch neither Cloudinary nor MongoDB
 *   --wipe-all-questions also delete questions of every other center
 *   SEED_CENTER_NAME     default "Soft Polynomials"
 *   SEED_CENTER_CODE     default "SOFTPOLY" (used only when the center must be created)
 *   SEED_ALC_EMAIL / SEED_ALC_PASSWORD   login for the center (created only if it has none)
 *   SEED_TEST_DURATION   minutes per test (default 30)
 */
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { connectAndSyncIndexes } from "../src/lib/db";
import { env } from "../src/lib/env";
import { uploadImage } from "../src/lib/cloudinary";
import { ALCCenter } from "../src/models/ALCCenter";
import { User } from "../src/models/User";
import { School } from "../src/models/School";
import { Question } from "../src/models/Question";
import { Test, type IBlueprintEntry } from "../src/models/Test";
import { TestEnrollment } from "../src/models/TestEnrollment";
import { ExamAttempt } from "../src/models/ExamAttempt";
import { ExamResponse } from "../src/models/ExamResponse";
import { ExamResult } from "../src/models/ExamResult";
import type { Language, Stream } from "../src/lib/constants";

const DATA = path.join(__dirname, "seed-data");
const MANIFEST = path.join(DATA, ".cloudinary-manifest.json");
const ORD: Record<number, string> = { 5: "5th", 6: "6th", 7: "7th", 8: "8th", 9: "9th", 10: "10th", 11: "11th", 12: "12th" };

type Category = "SYLLABUS" | "AI_LITERACY" | "IT_LITERACY";
type Source = {
  cls: number;
  language: Language;
  category: Category;
  subject: string; // exam subject (what the blueprint refers to)
  group: string; // source book / file, kept in classGroup
  file: string; // absolute xlsx path
  streams: Stream[];
};

/* ------------------------------ source table ------------------------------ */

export function sources(): Source[] {
  const out: Source[] = [];
  const add = (s: Omit<Source, "streams"> & { streams?: Stream[] }) => out.push({ streams: [], ...s });

  // Classes 5–8: Maths + Science, English + Marathi.
  for (const cls of [5, 6, 7, 8]) {
    const dir = path.join(DATA, "syllabus-5-8", ORD[cls]!);
    for (const [lang, label] of [["en", "English"], ["mr", "Marathi"]] as const) {
      for (const subject of ["Maths", "Science"]) {
        add({ cls, language: lang, category: "SYLLABUS", subject, group: subject, file: path.join(dir, `${subject} (${label}).xlsx`) });
      }
    }
  }

  // Classes 9–10: Maths = Algebra + Geometry, Science (10th has Part 1 + Part 2).
  const books: Record<number, { subject: string; file: string }[]> = {
    9: [
      { subject: "Maths", file: "Algebra" },
      { subject: "Maths", file: "Geometry" },
      { subject: "Science", file: "Science" },
    ],
    10: [
      { subject: "Maths", file: "Algebra" },
      { subject: "Maths", file: "Geometry" },
      { subject: "Science", file: "Science Part 1" },
      { subject: "Science", file: "Science Part 2" },
    ],
  };
  for (const cls of [9, 10]) {
    for (const [lang, dirName] of [["en", ORD[cls]!], ["mr", `${ORD[cls]} Marathi`]] as const) {
      for (const b of books[cls]!) {
        add({
          cls, language: lang, category: "SYLLABUS", subject: b.subject, group: b.file,
          file: path.join(DATA, "syllabus-9-12", dirName, `${b.file}.xlsx`),
        });
      }
    }
  }

  // Classes 11–12: stream syllabus (English only in the supplied material).
  const streamSubjects: { file: string; subject: string; streams: Stream[] }[] = [
    { file: "Physics", subject: "Physics", streams: ["SCIENCE"] },
    { file: "Chemistry", subject: "Chemistry", streams: ["SCIENCE"] },
    { file: "Biology", subject: "Biology", streams: ["SCIENCE"] },
    { file: "Maths & Stats (Arts & Science)", subject: "Maths & Stats", streams: ["SCIENCE", "ARTS"] },
    { file: "Economics", subject: "Economics", streams: ["COMMERCE", "ARTS"] },
    { file: "Organisation of Commerce and Management", subject: "Organisation of Commerce and Management", streams: ["COMMERCE"] },
    { file: "Book-Keeping and Accountancy", subject: "Book-Keeping and Accountancy", streams: ["COMMERCE"] },
    { file: "Secretarial Practice", subject: "Secretarial Practice", streams: ["COMMERCE"] },
    { file: "Maths & Stats (Commerce)", subject: "Maths & Stats (Commerce)", streams: ["COMMERCE"] },
  ];
  for (const cls of [11, 12]) {
    for (const s of streamSubjects) {
      add({
        cls, language: "en", category: "SYLLABUS", subject: s.subject, group: s.file, streams: s.streams,
        file: path.join(DATA, "syllabus-9-12", ORD[cls]!, `${s.file}.xlsx`),
      });
    }
  }

  // AI / IT Literacy: shared by 8–10 and by 11–12, English + Marathi.
  for (const cls of [8, 9, 10, 11, 12]) {
    const band = cls <= 10 ? "8th-10th" : "11th-12th";
    for (const [lang, root, dir] of [
      ["en", "literacy-en", band],
      ["mr", "literacy-mr", `${band} Marathi`],
    ] as const) {
      for (const [category, file] of [["AI_LITERACY", "AI Literacy"], ["IT_LITERACY", "IT Literacy"]] as const) {
        add({ cls, language: lang, category, subject: file, group: file, file: path.join(DATA, root, dir, `${file}.xlsx`) });
      }
    }
  }
  return out;
}

/* ------------------------------- blueprints ------------------------------- */

const e = (label: string, category: Category, subjects: string[], count: number, extra: Partial<IBlueprintEntry> = {}): IBlueprintEntry =>
  ({ label, category, subjects, count, ...extra }) as IBlueprintEntry;

export function blueprintFor(cls: number): { languages: Language[]; blueprint: IBlueprintEntry[] } {
  if (cls <= 7) {
    return { languages: ["en", "mr"], blueprint: [e("Maths", "SYLLABUS", ["Maths"], 12), e("Science", "SYLLABUS", ["Science"], 13)] };
  }
  if (cls <= 10) {
    return {
      languages: ["en", "mr"],
      blueprint: [
        e("Maths", "SYLLABUS", ["Maths"], 7),
        e("Science", "SYLLABUS", ["Science"], 6),
        e("AI Literacy", "AI_LITERACY", [], 6),
        e("IT Literacy", "IT_LITERACY", [], 6),
      ],
    };
  }
  // 11–12: 9 stream-syllabus + 8 AI + 8 IT. Syllabus is English-only, so a Marathi
  // student gets English syllabus questions (fallbackLanguage) and Marathi AI/IT.
  const syl = (stream: Stream, label: string, subj: string, n: number) =>
    e(`${stream[0] + stream.slice(1).toLowerCase()} – ${label}`, "SYLLABUS", [subj], n, { streams: [stream], fallbackLanguage: "en" });
  return {
    languages: ["en", "mr"],
    blueprint: [
      syl("SCIENCE", "Physics", "Physics", 2),
      syl("SCIENCE", "Chemistry", "Chemistry", 2),
      syl("SCIENCE", "Biology", "Biology", 2),
      syl("SCIENCE", "Maths & Stats", "Maths & Stats", 3),
      syl("COMMERCE", "Economics", "Economics", 2),
      syl("COMMERCE", "Organisation of Commerce and Management", "Organisation of Commerce and Management", 2),
      syl("COMMERCE", "Book-Keeping and Accountancy", "Book-Keeping and Accountancy", 2),
      syl("COMMERCE", "Secretarial Practice", "Secretarial Practice", 1),
      syl("COMMERCE", "Maths & Stats", "Maths & Stats (Commerce)", 2),
      syl("ARTS", "Economics", "Economics", 5),
      syl("ARTS", "Maths & Stats", "Maths & Stats", 4),
      e("AI Literacy", "AI_LITERACY", [], 8),
      e("IT Literacy", "IT_LITERACY", [], 8),
    ],
  };
}

/** What one student actually receives (for validation/printing). */
function perStudentTotal(bp: IBlueprintEntry[], stream: Stream | null): number {
  return bp.filter((b) => !b.streams?.length || (stream && b.streams.includes(stream))).reduce((s, b) => s + b.count, 0);
}

/* -------------------------------- parsing --------------------------------- */

type ParsedQ = {
  src: Source;
  qno: number;
  chapter: string;
  text: string;
  imageFile: string | null; // absolute path
  options: { key: "A" | "B" | "C" | "D"; text: string }[];
  correct: "A" | "B" | "C" | "D";
  difficulty: "EASY" | "MEDIUM" | "HARD";
};

const cell = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v) return String(v.text ?? "").trim();
    if ("result" in v) return String(v.result ?? "").trim();
  }
  return String(v).trim();
};

export async function parseSource(src: Source): Promise<ParsedQ[]> {
  if (!fs.existsSync(src.file)) throw new Error(`Missing Excel file: ${src.file}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(src.file);
  const ws = wb.worksheets[0]!;
  const out: ParsedQ[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const v = (i: number) => cell(row.getCell(i).value);
    const text = v(3);
    if (!text) return;
    const rel = v(4);
    const imageFile = rel ? path.join(path.dirname(src.file), rel) : null;
    if (imageFile && !fs.existsSync(imageFile)) throw new Error(`${src.file} row ${n}: image not found: ${rel}`);
    const keys = ["A", "B", "C", "D"] as const;
    const options = keys.map((k, i) => ({ key: k, text: v(5 + i) }));
    if (options.some((o) => !o.text)) throw new Error(`${src.file} row ${n}: empty option`);
    const correct = v(9).toUpperCase();
    if (!(keys as readonly string[]).includes(correct)) throw new Error(`${src.file} row ${n}: bad answer "${correct}"`);
    const diff = v(10).toUpperCase();
    out.push({
      src,
      qno: Number(v(1)) || n - 1,
      chapter: v(2),
      text,
      imageFile,
      options,
      correct: correct as ParsedQ["correct"],
      difficulty: (["EASY", "MEDIUM", "HARD"].includes(diff) ? diff : "MEDIUM") as ParsedQ["difficulty"],
    });
  });
  return out;
}

/* -------------------------- Cloudinary (with cache) ----------------------- */

type Manifest = Record<string, string>; // sha1 -> secure_url
const loadManifest = (): Manifest => {
  try { return JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Manifest; } catch { return {}; }
};
const saveManifest = (m: Manifest) => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 1));

async function uploadAll(files: string[], dryRun: boolean): Promise<Map<string, string>> {
  const manifest = loadManifest();
  const urlByFile = new Map<string, string>();
  const byHash = new Map<string, string[]>(); // hash -> files with that content
  for (const f of files) {
    const h = crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");
    byHash.set(h, [...(byHash.get(h) ?? []), f]);
  }
  const todo = [...byHash.entries()].filter(([h]) => !manifest[h]);
  console.log(`  images: ${files.length} referenced, ${byHash.size} unique, ${byHash.size - todo.length} already uploaded, ${todo.length} to upload`);

  if (dryRun) {
    for (const [h, fs_] of byHash) for (const f of fs_) urlByFile.set(f, `https://res.cloudinary.com/DRYRUN/${h}.png`);
    return urlByFile;
  }
  if (todo.length > 0 && !env.cloudinary.configured) {
    throw new Error("Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET) but images must be uploaded.");
  }

  let done = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const [h, fl] = queue.shift()!;
      const f = fl[0]!;
      for (let attempt = 1; ; attempt++) {
        try {
          const r = await uploadImage(fs.readFileSync(f), {
            folder: "exam-portal/questions",
            mimeType: "image/png",
            publicId: h, // content hash → re-running never creates duplicates
          });
          manifest[h] = r.url;
          break;
        } catch (err) {
          if (attempt >= 4) throw new Error(`Cloudinary upload failed for ${f}: ${(err as Error).message}`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      if (++done % 20 === 0 || done === todo.length) {
        saveManifest(manifest);
        console.log(`  uploaded ${done}/${todo.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  saveManifest(manifest);

  for (const [h, fl] of byHash) for (const f of fl) urlByFile.set(f, manifest[h]!);
  return urlByFile;
}

/* --------------------------------- main ----------------------------------- */

export async function seedExams(opts: { dryRun?: boolean; wipeAllQuestions?: boolean } = {}) {
  const dryRun = opts.dryRun ?? process.argv.includes("--dry-run");
  const wipeAll = opts.wipeAllQuestions ?? process.argv.includes("--wipe-all-questions");
  const centerName = process.env.SEED_CENTER_NAME || "Soft Polynomials";
  const duration = Number(process.env.SEED_TEST_DURATION) || 30;

  // 1. parse + validate everything first (fail before touching any data).
  console.log("Parsing Excel files…");
  const srcs = sources();
  const parsed: ParsedQ[] = [];
  for (const s of srcs) parsed.push(...(await parseSource(s)));
  console.log(`  ${srcs.length} sheets, ${parsed.length} question rows`);

  // 2. validate each blueprint against the parsed pool, per language & stream.
  for (const cls of [5, 6, 7, 8, 9, 10, 11, 12]) {
    const { languages, blueprint } = blueprintFor(cls);
    const streams: (Stream | null)[] = cls >= 11 ? ["SCIENCE", "COMMERCE", "ARTS"] : [null];
    for (const stream of streams) {
      const total = perStudentTotal(blueprint, stream);
      if (total !== 25) throw new Error(`Class ${cls} ${stream ?? ""}: blueprint serves ${total}, expected 25`);
      for (const lang of languages) {
        for (const b of blueprint) {
          if (b.streams?.length && (!stream || !b.streams.includes(stream))) continue;
          const have = (l: string) =>
            parsed.filter((p) => p.src.cls === cls && p.src.language === l && p.src.category === b.category && (!b.subjects.length || b.subjects.includes(p.src.subject))).length;
          const n = have(lang) >= b.count ? have(lang) : b.fallbackLanguage ? have(b.fallbackLanguage) : have(lang);
          if (n < b.count) throw new Error(`Class ${cls} ${lang} ${stream ?? ""} "${b.label}": need ${b.count}, have ${n}`);
        }
      }
    }
  }
  console.log("  blueprints OK (25 per student for every class / language / stream)");

  // 3. images
  console.log("Images…");
  const imageFiles = [...new Set(parsed.map((p) => p.imageFile).filter((x): x is string => !!x))];
  const urlByFile = await uploadAll(imageFiles, dryRun);

  if (dryRun) {
    console.log("Dry run: stopping before any database changes.");
    return;
  }

  // 4. center + owner
  await connectAndSyncIndexes();
  let center = await ALCCenter.findOne({ name: { $regex: `^\\s*${centerName.replace(/\s+/g, "\\s+")}\\s*$`, $options: "i" } });
  if (!center) {
    center = await ALCCenter.create({
      name: centerName,
      code: (process.env.SEED_CENTER_CODE || "SOFTPOLY").toUpperCase(),
      isActive: true,
    });
    console.log(`✓ Created center "${center.name}" (code ${center.code})`);
  } else {
    console.log(`✓ Using existing center "${center.name}" (code ${center.code})`);
  }
  let owner = await User.findOne({ center: center._id, role: "ALC_CENTER" });
  if (!owner && process.env.SEED_ALC_EMAIL && process.env.SEED_ALC_PASSWORD) {
    owner = await User.create({
      name: centerName,
      email: process.env.SEED_ALC_EMAIL.toLowerCase(),
      username: (process.env.SEED_ALC_USERNAME || "center").toLowerCase(),
      passwordHash: await bcrypt.hash(process.env.SEED_ALC_PASSWORD, 12),
      role: "ALC_CENTER",
      center: center._id,
      isActive: true,
    });
    console.log(`✓ Created center login ${owner.email}`);
  }
  await School.updateOne(
    { center: center._id, name: "Demo School" },
    { $setOnInsert: { center: center._id, name: "Demo School", address: "", phone: "" } },
    { upsert: true }
  );
  owner ??= await User.findOne({ role: "SUPER_ADMIN" });
  if (!owner) throw new Error("No center or SUPER_ADMIN user found — run the admin seed first.");
  const createdBy = owner._id as Types.ObjectId;

  // 5. wipe previous questions + tests of this center
  const oldTests = await Test.find({ center: center._id }).select("_id").lean();
  const oldIds = oldTests.map((t) => t._id);
  const liveAttempts = await ExamAttempt.countDocuments({ test: { $in: oldIds } });
  if (liveAttempts > 0 && !process.argv.includes("--force")) {
    throw new Error(
      `${liveAttempts} student attempt(s) already exist on this center's tests. Re-seeding would delete them. ` +
        `Re-run with --force if that is really what you want.`
    );
  }
  const attempts = await ExamAttempt.find({ test: { $in: oldIds } }).select("_id").lean();
  const del = {
    responses: (await ExamResponse.deleteMany({ attempt: { $in: attempts.map((a) => a._id) } })).deletedCount,
    results: (await ExamResult.deleteMany({ test: { $in: oldIds } })).deletedCount,
    attempts: (await ExamAttempt.deleteMany({ test: { $in: oldIds } })).deletedCount,
    enrollments: (await TestEnrollment.deleteMany({ test: { $in: oldIds } })).deletedCount,
    tests: (await Test.deleteMany({ center: center._id })).deletedCount,
    questions: (await Question.deleteMany(wipeAll ? {} : { center: center._id })).deletedCount,
  };
  console.log("✓ Removed previous data:", JSON.stringify(del));

  // 6. tests + question pools
  const totals: string[] = [];
  for (const cls of [5, 6, 7, 8, 9, 10, 11, 12]) {
    const { languages, blueprint } = blueprintFor(cls);
    const test = await Test.create({
      center: center._id,
      createdBy,
      name: `Class ${ORD[cls]} Test`,
      description: `Class ${ORD[cls]} online test. Covered: ${cls >= 8 ? "Syllabus, AI and IT Literacy" : "Syllabus"}`,
      instructions:
        "Choose your language, then answer 25 multiple-choice questions. Each student receives a different random set of questions. " +
        "You can mark questions for review and change answers until you submit.",
      targetClass: cls,
      targetStream: null, // 11/12: one test for all streams; each student's stream decides the syllabus part
      totalQuestions: 25,
      duration,
      passingPercentage: 40,
      marksPerQuestion: 1,
      negativeMarking: { enabled: false, value: 0 },
      languages,
      blueprint,
      // OPTIONAL: the student chooses whether to be proctored (default: proctored).
      proctoring: { mode: "OPTIONAL", requireMic: false, requireFullscreen: true, maxTabSwitches: 3 },
      reviewStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewedBy: createdBy,
      submittedAt: new Date(),
      status: "ACTIVE",
      schedule: { eligibleClasses: [cls], eligibleStreams: [] },
    });

    const docs = parsed
      .filter((p) => p.src.cls === cls)
      .map((p) => ({
        center: center!._id,
        test: test._id,
        createdBy,
        text: p.text,
        options: p.options,
        correctOption: p.correct,
        difficulty: p.difficulty,
        class: cls,
        classGroup: p.src.group,
        category: p.src.category,
        stream: null,
        streams: p.src.streams,
        subject: p.src.subject,
        chapter: p.chapter || null,
        language: p.src.language,
        imageUrl: p.imageFile ? urlByFile.get(p.imageFile) ?? null : null,
        sourceKey: `${cls}|${p.src.language}|${p.src.group}|${p.qno}`,
        isActive: true,
      }));
    for (let i = 0; i < docs.length; i += 500) await Question.insertMany(docs.slice(i, i + 500), { ordered: true });
    const withImg = docs.filter((d) => d.imageUrl).length;
    totals.push(`${test.name}: ${docs.length} questions (${withImg} with images)`);
    console.log(`✓ ${test.name}: ${docs.length} questions, ${withImg} with images`);
  }
  return totals;
}

if (require.main === module) {
  seedExams()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Exam seed failed:", err);
      process.exit(1);
    });
}
