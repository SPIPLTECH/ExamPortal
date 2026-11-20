import { connectDB } from "./db";
import { Test, type ITest } from "@/models/Test";
import { Question } from "@/models/Question";
import { ExamAttempt, type IExamAttempt } from "@/models/ExamAttempt";
import { ExamResponse } from "@/models/ExamResponse";
import { ExamResult } from "@/models/ExamResult";
import { buildFrozenFromPool, toClientQuestion } from "./exam-selection";

/**
 * Build the frozen question set for a brand-new attempt from the TEST'S OWN
 * question pool. Each student gets a different RANDOM subset of `totalQuestions`
 * (e.g. 25 of 100) with shuffled options. Throws if the pool is too small.
 */
export async function freezeQuestionSet(test: ITest): Promise<IExamAttempt["questions"]> {
  await connectDB();
  const pool = await Question.find({ test: test._id, isActive: true }).lean();
  const need = test.totalQuestions;
  if (pool.length < need) {
    throw new Error(
      `This test has only ${pool.length} question(s); ${need} are required per student. Add more questions.`
    );
  }
  return buildFrozenFromPool(pool, need, {
    marksPerQuestion: test.marksPerQuestion,
    negativeMarks: test.negativeMarking?.value ?? 0,
  });
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
