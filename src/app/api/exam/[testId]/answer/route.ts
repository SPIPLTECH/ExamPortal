import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ExamResponse } from "@/models/ExamResponse";
import { requireStudent } from "@/lib/auth-helpers";
import { finalizeAttempt } from "@/lib/exam-engine";
import { saveAnswerSchema } from "@/lib/validations";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import type { ResponseStatus } from "@/lib/constants";

/**
 * Hot path: called on every option click. Kept to the minimum work —
 * JWT-only auth (no profile lookup), a lean projection of the attempt (no question
 * text/options pulled over the wire) and a single upsert.
 */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session } = await requireStudent();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  const parsed = await parseBody(req, saveAnswerSchema);
  if (parsed.error) return parsed.error;
  const { questionId, selectedOption, markedForReview } = parsed.data;

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: session.user.id })
    .select("status deadlineAt questions.question")
    .lean();
  if (!attempt) return fail("No active attempt", 404);
  if (attempt.status !== "IN_PROGRESS") return fail("This exam is no longer active", 409);

  // Server-authoritative deadline: reject (and auto-submit) late saves.
  if (new Date() > new Date(attempt.deadlineAt)) {
    const full = await ExamAttempt.findById(attempt._id);
    if (full && full.status === "IN_PROGRESS") await finalizeAttempt(full, "TIMED_OUT");
    return fail("Time is up — your exam was submitted automatically", 409);
  }

  // The question must belong to this frozen attempt.
  if (!attempt.questions.some((q) => String(q.question) === questionId)) {
    return fail("Question not part of this attempt", 400);
  }

  let status: ResponseStatus = "UNATTEMPTED";
  if (selectedOption && markedForReview) status = "ANSWERED_MARKED";
  else if (selectedOption) status = "ATTEMPTED";
  else if (markedForReview) status = "MARKED";

  await ExamResponse.updateOne(
    { attempt: attempt._id, question: questionId },
    {
      $set: { selectedOption: selectedOption ?? null, status, student: session.user.id },
    },
    { upsert: true }
  );

  return ok({ status });
});
