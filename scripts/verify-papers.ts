/** Offline check: simulates many students per class/language/stream and verifies every paper. No DB needed. */
import { sources, parseSource, blueprintFor } from "./seed-exams";
import mongoose from "mongoose";
import { Question } from "../src/models/Question";
import { freezeQuestionSet } from "../src/lib/exam-engine";

(async () => {
  process.env.MONGODB_URI = "mongodb://stub";
  (mongoose as any).connect = async () => mongoose; // no real DB in this check
  const all: any[] = [];
  let id = 0;
  for (const s of sources()) for (const p of await parseSource(s)) all.push({
    _id: ++id, test: s.cls, class: s.cls, category: s.category, subject: s.subject, language: s.language,
    streams: s.streams, isActive: true, text: p.text, imageUrl: p.imageFile, options: p.options, correctOption: p.correct,
  });
  (Question as any).find = (q: any) => ({ lean: async () => all.filter((d) =>
    d.test === q.test && d.category === q.category && (!q.language || d.language === q.language) &&
    (!q.subject || q.subject.$in.includes(d.subject))) });

  // The engine draws blueprint slices with $sample; emulate it on the same in-memory pool.
  (Question as any).aggregate = async (stages: any[]) => {
    const m = stages[0].$match, size = stages[1].$sample.size;
    const ok = (d: any) => d.test === m.test && d.category === m.category &&
      (!m.language || (m.language.$in ? m.language.$in.includes(d.language ?? null) : m.language === d.language)) &&
      (!m.subject || m.subject.$in.includes(d.subject));
    const hit = all.filter(ok);
    return hit.sort(() => Math.random() - 0.5).slice(0, size);
  };

  let bad = 0, papers = 0;
  for (const cls of [5, 6, 7, 8, 9, 10, 11, 12]) {
    const { languages, blueprint } = blueprintFor(cls);
    const test: any = { _id: cls, totalQuestions: 25, marksPerQuestion: 1, negativeMarking: { value: 0 }, languages, blueprint };
    for (const stream of cls >= 11 ? ["SCIENCE", "COMMERCE", "ARTS"] : [null]) for (const language of languages) {
      const seen = new Set<string>(); const sigs = new Set<string>();
      for (let i = 0; i < 200; i++) {
        const qs: any[] = await freezeQuestionSet(test, { language, stream });
        papers++;
        const ids = qs.map((q) => q.question);
        const byCat: Record<string, number> = {}, bySub: Record<string, number> = {};
        for (const q of qs) { const d = all[q.question - 1]; byCat[d.category] = (byCat[d.category] ?? 0) + 1; bySub[d.subject] = (bySub[d.subject] ?? 0) + 1;
          // correct answer must still point at the same option text after shuffling
          const orig = d.options.find((o: any) => o.key === d.correctOption).text;
          if (q.options.find((o: any) => o.key === q.correctOption)?.text !== orig) { bad++; console.log("answer remap broken", d.text); }
          if (stream && d.streams.length && !d.streams.includes(stream)) { bad++; console.log("wrong stream q"); }
          if (d.language !== language && !(cls >= 11 && d.category === "SYLLABUS" && d.language === "en")) { bad++; console.log("wrong language q"); }
          ids.forEach((x) => seen.add(String(x))); }
        if (qs.length !== 25 || new Set(ids).size !== 25) { bad++; console.log("size/dup", cls, language, stream, qs.length); }
        sigs.add(ids.slice().sort().join(","));
        if (i === 0) console.log(`Class ${cls} ${language} ${stream ?? "-"}:`, JSON.stringify(byCat), JSON.stringify(bySub));
      }
      if (sigs.size < 190) { bad++; console.log("papers not random enough", cls, sigs.size); }
    }
  }
  console.log(`${papers} papers checked, problems: ${bad}`);
  process.exit(bad ? 1 : 0);
})();
