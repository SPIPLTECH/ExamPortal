/**
 * Read-only production check: for every test that offers several languages, counts questions per
 * language/category and flags "mr" questions that contain NO Devanagari (i.e. English text stored
 * under the Marathi tag) and tests whose language pool is too small.
 *   npx tsx scripts/check-languages.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Test } from "../src/models/Test";
import { Question } from "../src/models/Question";

const DEVANAGARI = /[ऀ-ॿ]/;

(async () => {
  await connectDB();
  const tests = await Test.find({ "languages.0": { $exists: true } }).lean();
  let problems = 0;
  for (const t of tests) {
    const qs = await Question.find({ test: t._id, isActive: true }).select("language category text options").lean();
    const by: Record<string, number> = {};
    for (const q of qs) { const k = `${q.language ?? "none"}/${q.category}`; by[k] = (by[k] ?? 0) + 1; }
    const mr = qs.filter((q) => q.language === "mr");
    // Pure maths/symbol questions (e.g. "(x+3)(x-3) = ?") legitimately have no Devanagari.
    // Flag only when the text has several real English words and no Devanagari anywhere.
    const MATHWORDS = /\b(sin|cos|tan|cot|sec|cosec|log|lim|exp|det|mod)\b/gi;
    const englishWords = (t: string) => (t.replace(MATHWORDS, " ").match(/[A-Za-z]{3,}/g) ?? []).length;
    const fake = mr.filter((q) => englishWords(q.text) >= 3 && !DEVANAGARI.test(q.text) && !q.options.some((o) => DEVANAGARI.test(o.text)));
    const untagged = qs.filter((q) => !q.language).length;
    console.log(`\n${t.name}  languages=[${t.languages}] blueprint=${t.blueprint?.length ?? 0}`);
    console.log("  ", JSON.stringify(by));
    if (!t.blueprint?.length) { problems++; console.log("  ! no blueprint: plain pool mode"); }
    if (untagged) { problems++; console.log(`  ! ${untagged} questions have no language tag`); }
    if (t.languages.includes("mr") && !mr.length) { problems++; console.log("  ! offers Marathi but has ZERO Marathi questions"); }
    if (fake.length) { problems++; console.log(`  ! ${fake.length}/${mr.length} 'mr' questions contain no Devanagari, e.g. "${fake[0]!.text.slice(0, 60)}"`); }
  }
  console.log(`\n${tests.length} multi-language tests checked, problems: ${problems}`);
  await mongoose.disconnect();
})();