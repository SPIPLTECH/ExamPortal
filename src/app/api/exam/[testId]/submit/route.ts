import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { requireStudentContext } from "@/lib/student";
import { finalizeAttempt, isExpired } from "@/lib/exam-engine";
import { ok, fail, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: ctx.user.id });
  if (!attempt) return fail("No active attempt", 404);
  if (attempt.status !== "IN_PROGRESS") {
    return fail("This exam has already been submitted", 409);
  }

  const reason = isExpired(attempt) ? "TIMED_OUT" : "SUBMITTED";
  const result = await finalizeAttempt(attempt, reason);

  await audit({
    actorId: ctx.user.id,
    actorRole: "STUDENT",
    action: "EXAM_SUBMITTED",
    entityType: "ExamAttempt",
    entityId: attempt._id.toString(),
    metadata: { reason, score: result.score, percentage: result.percentage },
    ip: clientIp(req),
  });

  return ok({
    attemptId: attempt._id.toString(),
    score: result.score,
    totalMarks: result.totalMarks,
    percentage: result.percentage,
    passed: result.passed,
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    unattemptedCount: result.unattemptedCount,
    categoryBreakdown: result.categoryBreakdown,
  });
});
