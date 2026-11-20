import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ExamResponse } from "@/models/ExamResponse";
import { requireStudentContext } from "@/lib/student";
import { finalizeAttempt, isExpired } from "@/lib/exam-engine";
import { saveAnswerSchema } from "@/lib/validations";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import type { ResponseStatus } from "@/lib/constants";

export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  const parsed = await parseBody(req, saveAnswerSchema);
  if (parsed.error) return parsed.error;
  const { questionId, selectedOption, markedForReview } = parsed.data;

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: ctx.user.id });
  if (!attempt) return fail("No active attempt", 404);
  if (attempt.status !== "IN_PROGRESS") return fail("This exam is no longer active", 409);

  // Server-authoritative deadline: reject (and auto-submit) late saves.
  if (isExpired(attempt)) {
    await finalizeAttempt(attempt, "TIMED_OUT");
    return fail("Time is up — your exam was submitted automatically", 409);
  }

  // The question must belong to this frozen attempt.
  const belongs = attempt.questions.some((q) => String(q.question) === questionId);
  if (!belongs) return fail("Question not part of this attempt", 400);

  let status: ResponseStatus = "UNATTEMPTED";
  if (selectedOption && markedForReview) status = "ANSWERED_MARKED";
  else if (selectedOption) status = "ATTEMPTED";
  else if (markedForReview) status = "MARKED";

  await ExamResponse.findOneAndUpdate(
    { attempt: attempt._id, question: questionId },
    {
      attempt: attempt._id,
      question: questionId,
      student: ctx.user.id,
      selectedOption: selectedOption ?? null,
      status,
    },
    { upsert: true, new: true }
  );

  return ok({ status });
});
