import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ExamResult } from "@/models/ExamResult";
import { ExamResponse } from "@/models/ExamResponse";
import { Test } from "@/models/Test";
import { requireStudentContext } from "@/lib/student";
import { ok, fail, handleRoute } from "@/lib/api";

/** Per-attempt result detail with a question-by-question review. */
export const GET = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { attemptId } = await (ctxArg as { params: Promise<{ attemptId: string }> }).params;

  await connectDB();
  const attempt = await ExamAttempt.findOne({ _id: attemptId, student: ctx.user.id }).lean();
  if (!attempt) return fail("Attempt not found", 404);
  if (attempt.status === "IN_PROGRESS") return fail("This exam is still in progress", 409);

  const [result, responses, test] = await Promise.all([
    ExamResult.findOne({ attempt: attempt._id }).lean(),
    ExamResponse.find({ attempt: attempt._id }).lean(),
    Test.findById(attempt.test).select("name showResult").lean(),
  ]);

  const answerByQ = new Map(responses.map((r) => [String(r.question), r.selectedOption ?? null]));

  // Per-question review. The exam is over and the result is released, so the
  // correct option is shown for learning.
  const questions = attempt.questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      const selected = answerByQ.get(String(q.question)) ?? null;
      return {
        order: q.order,
        category: q.category,
        text: q.text,
        imageUrl: q.imageUrl ?? null,
        options: q.options.map((o) => ({ key: o.key, text: o.text })),
        selectedOption: selected,
        correctOption: q.correctOption,
        isCorrect: selected != null && selected === q.correctOption,
        marks: q.marks,
      };
    });

  return ok({
    testName: test?.name ?? "Examination",
    status: attempt.status,
    submittedAt: attempt.submittedAt,
    result: result
      ? {
          score: result.score,
          totalMarks: result.totalMarks,
          percentage: result.percentage,
          passed: result.passed,
          correctCount: result.correctCount,
          wrongCount: result.wrongCount,
          unattemptedCount: result.unattemptedCount,
          categoryBreakdown: result.categoryBreakdown,
        }
      : null,
    questions,
  });
});
