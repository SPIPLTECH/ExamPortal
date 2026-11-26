import { connectDB } from "./db";
import { Test, type ITest } from "@/models/Test";
import { Question, type IQuestion } from "@/models/Question";
import { ExamAttempt, type IExamAttempt } from "@/models/ExamAttempt";
import { ExamResponse } from "@/models/ExamResponse";
import { ExamResult } from "@/models/ExamResult";
import { buildFrozenFromPool, buildFrozenFromPicks, shuffle, toClientQuestion } from "./exam-selection";
import type { IBlueprintEntry } from "@/models/Test";

/** Match the student's language. Untagged legacy questions (language = null) count as English,
 *  so they can never leak into a Marathi paper. */
const languageMatch = (lang: string | null) =>
  !lang ? undefined : lang === "en" ? { $in: ["en", null] } : lang;

/** Draw `entry.count` random questions for one blueprint slice. */
async function drawEntry(
  test: ITest,
  entry: IBlueprintEntry,
  language: string | null
) {
  const build = (lang: string | null) => {
    const q: Record<string, unknown> = {
      test: test._id,
      isActive: true,
      category: entry.category,
    };
    const lm = languageMatch(lang);
    if (lm) q.language = lm;
    if (entry.subjects?.length) q.subject = { $in: entry.subjects };
    return q;
  };

  // Let MongoDB pick the random questions ($sample) instead of loading the whole pool into memory.
  const sample = (lang: string | null) =>
    Question.aggregate<IQuestion>([
      { $match: build(lang) },
      { $sample: { size: entry.count } },
    ]);
  let picked = await sample(language);
  // Only an EXPLICIT fallbackLanguage on the blueprint entry may serve another language.
  if (picked.length < entry.count && entry.fallbackLanguage && entry.fallbackLanguage !== language) {
    picked = await sample(entry.fallbackLanguage);
  }
  if (picked.length < entry.count) {
    throw new Error(
      `Not enough questions for "${entry.label}" in ${language ?? "the selected language"}: need ${entry.count}, have ${picked.length}.`
    );
  }
  // Defensive guard: never hand a student a question in a language they did not choose.
  const allowed = new Set<string | null>([language, entry.fallbackLanguage ?? null]);
  if (language === "en") allowed.add(null);
  const stray = picked.find((q) => !allowed.has(q.language ?? null));
  if (stray) {
    throw new Error(`Question language mismatch in "${entry.label}" (got ${stray.language}, expected ${language}).`);
  }
  return shuffle(picked);
}

/**
 * Build the frozen question set for a brand-new attempt from the TEST'S OWN
 * question pool. Each student gets a different RANDOM subset of `totalQuestions`
 * (e.g. 25 of 100) with shuffled options. Throws if the pool is too small.
 * The student's chosen language is enforced in BOTH blueprint and plain-pool mode.
 */
export async function freezeQuestionSet(
  test: ITest,
  opts: { language?: string | null; stream?: string | null } = {}
): Promise<IExamAttempt["questions"]> {
  await connectDB();
  const marking = {
    marksPerQuestion: test.marksPerQuestion,
    negativeMarks: test.negativeMarking?.value ?? 0,
  };

  // Blueprint mode: exact per-subject counts in the student's language/stream.
  if (test.blueprint && test.blueprint.length > 0) {
    const language = opts.language ?? test.languages?.[0] ?? null;
    const entries = test.blueprint.filter((entry) => {
      if (!entry.streams?.length) return true;
      if (!opts.stream) throw new Error("Your profile has no stream; contact your center.");
      return entry.streams.includes(opts.stream); // other streams' slices are skipped
    });
    // All slices are drawn at the same time (one query each, in parallel).
    const picks = await Promise.all(entries.map((entry) => drawEntry(test, entry, language)));
    return buildFrozenFromPicks(picks, marking);
  }

  // Plain pool mode: previously the language was ignored here, so every student got the
  // whole (mostly English) pool whatever they chose. Filter by the chosen language.
  const language = opts.language ?? (test.languages?.length === 1 ? test.languages[0]! : null);
  const filter: Record<string, unknown> = { test: test._id, isActive: true };
  const lm = test.languages?.length ? languageMatch(language) : undefined;
  if (lm) filter.language = lm;
  const pool = await Question.find(filter).lean();
  const need = test.totalQuestions;
  if (pool.length < need) {
    throw new Error(
      `This test has only ${pool.length} question(s)${language ? ` in the selected language (${language})` : ""}; ${need} are required per student. Add more questions.`
    );
  }
  return buildFrozenFromPool(pool, need, marking);
}

/**
 * Languages this test can REALLY be taken in (enough questions in the DB for every blueprint
 * slice / the whole pool). The exam room only offers these, so a student can never pick a
 * language that has no questions.
 */
export async function availableLanguages(test: ITest, stream: string | null): Promise<string[]> {
  await connectDB();
  const offered = (test.languages ?? []) as string[];
  const out: string[] = [];
  for (const lang of offered) {
    let ok = true;
    if (test.blueprint && test.blueprint.length > 0) {
      for (const e of test.blueprint) {
        if (e.streams?.length && !(stream && (e.streams as string[]).includes(stream))) continue;
        const count = (l: string) => {
          const f: Record<string, unknown> = { test: test._id, isActive: true, category: e.category, language: languageMatch(l) };
          if (e.subjects?.length) f.subject = { $in: e.subjects };
          return Question.countDocuments(f);
        };
        let have = await count(lang);
        if (have < e.count && e.fallbackLanguage && e.fallbackLanguage !== lang) have = await count(e.fallbackLanguage);
        if (have < e.count) { ok = false; break; }
      }
    } else {
      ok = (await Question.countDocuments({ test: test._id, isActive: true, language: languageMatch(lang) })) >= test.totalQuestions;
    }
    if (ok) out.push(lang);
    else console.warn(`[language] test ${test._id}: "${lang}" has too few questions, not offered`);
  }
  return out;
}

/** Client-safe projection of an attempt (no correct answers). */
export async function projectAttempt(attempt: IExamAttempt, testName: string) {
  const responses = await ExamResponse.find({ attempt: attempt._id }).lean();
  return {
    attemptId: String(attempt._id),
    testName,
    status: attempt.status,
    deadlineAt: attempt.deadlineAt,
    serverNow: new Date(),
    durationMinutes: attempt.durationMinutes,
    proctoringMode: attempt.proctoringMode,
    questions: attempt.questions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toClientQuestion),
    responses: responses.map((r) => ({
      question: String(r.question),
      selectedOption: r.selectedOption ?? null,
      status: r.status,
    })),
  };
}

/** Grade an attempt, persist ExamResult, and mark the attempt finished. */
export async function finalizeAttempt(
  attempt: IExamAttempt,
  reason: "SUBMITTED" | "TIMED_OUT" | "TERMINATED"
) {
  await connectDB();
  const responses = await ExamResponse.find({ attempt: attempt._id }).lean();
  const answerByQ = new Map(responses.map((r) => [String(r.question), r.selectedOption]));

  const test = await Test.findById(attempt.test).lean();
  const marksPerQ = test?.marksPerQuestion ?? 1;
  const negPerQ = test?.negativeMarking?.enabled ? test.negativeMarking.value : 0;

  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedCount = 0;
  const catMap = new Map<string, { total: number; correct: number; wrong: number; unattempted: number }>();

  for (const q of attempt.questions) {
    const cat = catMap.get(q.category) ?? { total: 0, correct: 0, wrong: 0, unattempted: 0 };
    cat.total += 1;
    const sel = answerByQ.get(String(q.question));
    if (!sel) {
      unattemptedCount += 1;
      cat.unattempted += 1;
    } else if (sel === q.correctOption) {
      score += marksPerQ;
      correctCount += 1;
      cat.correct += 1;
    } else {
      score -= negPerQ;
      wrongCount += 1;
      cat.wrong += 1;
    }
    catMap.set(q.category, cat);
  }

  if (score < 0) score = 0;
  const totalMarks = attempt.questions.length * marksPerQ;
  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
  const passByMarks = test?.passingMarks ? score >= test.passingMarks : true;
  const passByPct = test?.passingPercentage ? percentage >= test.passingPercentage : true;
  const passed = passByMarks && passByPct;

  attempt.status = reason;
  attempt.submittedAt = new Date();
  if (reason === "TERMINATED") attempt.terminationReason = attempt.terminationReason ?? "Proctoring termination";
  await (attempt as unknown as { save: () => Promise<unknown> }).save();

  const result = await ExamResult.findOneAndUpdate(
    { attempt: attempt._id },
    {
      attempt: attempt._id,
      test: attempt.test,
      student: attempt.student,
      center: attempt.center,
      score,
      totalMarks,
      percentage: Math.round(percentage * 100) / 100,
      passed,
      correctCount,
      wrongCount,
      unattemptedCount,
      categoryBreakdown: Array.from(catMap.entries()).map(([category, v]) => ({ category, ...v })),
      released: test?.status ? true : true,
    },
    { upsert: true, new: true }
  );

  return result;
}

/** True if the attempt's deadline has passed. */
export function isExpired(attempt: Pick<IExamAttempt, "deadlineAt">): boolean {
  return new Date() > new Date(attempt.deadlineAt);
}
