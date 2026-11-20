/**
 * Dev helper: populate the demo center (code DEMO01) with enough questions to
 * make class 6, 9 and 11 tests feasible. Idempotent-ish (skips if bank already
 * large). Run: npx tsx scripts/seed-questions.ts
 */
import "dotenv/config";
import { connectDB } from "../src/lib/db";
import { ALCCenter } from "../src/models/ALCCenter";
import { User } from "../src/models/User";
import { Question } from "../src/models/Question";

type Spec = { cls: number; category: string; stream: string | null; count: number };

const SPECS: Spec[] = [
  { cls: 6, category: "SYLLABUS", stream: null, count: 30 },
  { cls: 9, category: "SYLLABUS", stream: null, count: 15 },
  { cls: 9, category: "AI_LITERACY", stream: null, count: 12 },
  { cls: 9, category: "IT_LITERACY", stream: null, count: 12 },
  { cls: 11, category: "SYLLABUS", stream: "SCIENCE", count: 15 },
  { cls: 11, category: "AI_LITERACY", stream: null, count: 12 },
  { cls: 11, category: "IT_LITERACY", stream: null, count: 12 },
];

function makeQuestion(center: string, createdBy: string, s: Spec, n: number) {
  const correct = ["A", "B", "C", "D"][n % 4];
  return {
    center,
    createdBy,
    text: `[${s.category} C${s.cls}${s.stream ? " " + s.stream : ""}] Sample question #${n + 1}: which option is correct?`,
    options: [
      { key: "A", text: `Option A for Q${n + 1}` },
      { key: "B", text: `Option B for Q${n + 1}` },
      { key: "C", text: `Option C for Q${n + 1}` },
      { key: "D", text: `Option D for Q${n + 1}` },
    ],
    correctOption: correct,
    difficulty: ["EASY", "MEDIUM", "HARD"][n % 3],
    class: s.cls,
    category: s.category,
    stream: s.cls >= 11 ? s.stream : null,
  };
}

async function main() {
  await connectDB();
  const center = await ALCCenter.findOne({ code: "DEMO01" });
  if (!center) {
    console.error("Demo center DEMO01 not found. Run: SEED_DEMO_CENTER=true npm run seed");
    process.exit(1);
  }
  const admin = await User.findOne({ center: center._id, role: "ALC_CENTER" });
  const createdBy = admin?._id ?? center._id;

  let created = 0;
  for (const s of SPECS) {
    const existing = await Question.countDocuments({
      center: center._id,
      class: s.cls,
      category: s.category,
      ...(s.stream ? { stream: s.stream } : {}),
      text: { $regex: "Sample question" },
    });
    const need = Math.max(0, s.count - existing);
    if (need === 0) continue;
    const docs = Array.from({ length: need }, (_, i) =>
      makeQuestion(center._id.toString(), createdBy.toString(), s, existing + i)
    );
    await Question.insertMany(docs);
    created += docs.length;
    console.log(`  +${docs.length} ${s.category} class ${s.cls}${s.stream ? " " + s.stream : ""}`);
  }
  console.log(`Done. Created ${created} questions.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
