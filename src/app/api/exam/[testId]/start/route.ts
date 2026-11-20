import { connectDB } from "@/lib/db";
import { Test, type ITest } from "@/models/Test";
import { TestEnrollment } from "@/models/TestEnrollment";
import { ExamAttempt } from "@/models/ExamAttempt";
import { requireStudentContext, examLive } from "@/lib/student";
import { freezeQuestionSet, projectAttempt, finalizeAttempt, isExpired } from "@/lib/exam-engine";
import { ok, fail, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { User } from "@/models/User";

/** Start a new attempt or resume the existing one. Idempotent: a refresh never
 *  regenerates the question set. */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  await connectDB();
  const me = await User.findById(ctx.user.id).select("name image").lean();
  const withStudent = <T extends object>(o: T) => ({
    ...o,
    student: { name: me?.name ?? "", imageUrl: me?.image?.url ?? null },
  });
  const test = await Test.findById(testId).lean<ITest>();
  if (!test) return fail("Test not found", 404);

  const enrollment = await TestEnrollment.findOne({
    test: testId,
    student: ctx.user.id,
    status: "ENROLLED",
  });
  if (!enrollment) return fail("You must enroll before starting this exam", 403);

  // Existing attempt → resume if in progress, otherwise NO RETAKE.
  const existing = await ExamAttempt.findOne({ test: testId, student: ctx.user.id });
  if (existing) {
    if (existing.status === "IN_PROGRESS") {
      if (isExpired(existing)) {
        await finalizeAttempt(existing, "TIMED_OUT");
        return fail("Time is up — your exam was submitted automatically.", 409);
      }
      return ok(withStudent(await projectAttempt(existing, test.name))); // resume same frozen set
    }
    // Already submitted/timed-out/terminated: a student may attempt an exam only once.
    return fail("You have already attempted this exam. Retakes are not allowed.", 409);
  }

  // New attempt — the exam must be live.
  if (!examLive(test)) {
    const now = new Date();
    const s = test.schedule?.startTime ? new Date(test.schedule.startTime) : null;
    if (s && now < s) return fail("This exam has not started yet", 403);
    return fail("The exam window has closed", 403);
  }

  const questions = await freezeQuestionSet(test);
  if (questions.length === 0) return fail("No questions available for this exam", 422);

  const now = new Date();
  const durationMs = test.duration * 60_000;
  const windowEnd = test.schedule?.endTime ? new Date(test.schedule.endTime).getTime() : Infinity;
  const deadlineAt = new Date(Math.min(now.getTime() + durationMs, windowEnd));

  const proctoringMode =
    test.proctoring.mode === "OPTIONAL"
      ? (enrollment.proctoringChoice ?? "DISABLED")
      : test.proctoring.mode;

  const attempt = await ExamAttempt.create({
    test: test._id,
    student: ctx.user.id,
    enrollment: enrollment._id,
    center: test.center,
    status: "IN_PROGRESS",
    questions,
    proctoringMode,
    startedAt: now,
    deadlineAt,
    durationMinutes: test.duration,
  });

  await audit({
    actorId: ctx.user.id,
    actorRole: "STUDENT",
    action: "EXAM_STARTED",
    entityType: "ExamAttempt",
    entityId: attempt._id.toString(),
    metadata: { test: testId, questions: questions.length },
    ip: clientIp(req),
  });

  return ok(withStudent(await projectAttempt(attempt, test.name)), 201);
});
