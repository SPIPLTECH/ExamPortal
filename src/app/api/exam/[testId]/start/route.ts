import { connectDB } from "@/lib/db";
import { Test, type ITest } from "@/models/Test";
import { TestEnrollment } from "@/models/TestEnrollment";
import { ExamAttempt } from "@/models/ExamAttempt";
import { requireStudentContext, examLive, eligibleTestFilter } from "@/lib/student";
import { freezeQuestionSet, projectAttempt, finalizeAttempt, isExpired } from "@/lib/exam-engine";
import { ok, fail, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { User } from "@/models/User";
import { ALCCenter } from "@/models/ALCCenter";

/** Start a new attempt or resume the existing one. Idempotent: a refresh never
 *  regenerates the question set. */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  await connectDB();
  // Independent reads go out together instead of one after another.
  const [me, test, existingEnrollment, existing] = await Promise.all([
    User.findById(ctx.user.id).select("name image").lean(),
    Test.findById(testId).lean<ITest>(),
    TestEnrollment.findOne({ test: testId, student: ctx.user.id, status: "ENROLLED" }),
    ExamAttempt.findOne({ test: testId, student: ctx.user.id }),
  ]);
  if (!test) return fail("Test not found", 404);
  const centerDoc = await ALCCenter.findById(test.center).select("name").lean();
  const withStudent = <T extends object>(o: T) => ({
    ...o,
    student: { name: me?.name ?? "", imageUrl: me?.image?.url ?? null },
    centerName: centerDoc?.name ?? null,
  });

  let enrollment = existingEnrollment;
  if (!enrollment) {
    // Registered students are auto-enrolled for tests of their class/center.
    const eligible = await Test.exists({ _id: testId, ...eligibleTestFilter(ctx.profile) });
    if (!eligible) return fail("This exam is not available for you", 403);
    enrollment = await TestEnrollment.findOneAndUpdate(
      { test: testId, student: ctx.user.id },
      { $setOnInsert: { test: testId, student: ctx.user.id, center: test.center }, $set: { status: "ENROLLED" } },
      { upsert: true, new: true }
    );
  }

  // Existing attempt → resume if in progress, otherwise NO RETAKE.
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

  // Language: multi-language tests make the student choose BEFORE the paper is built.
  const offered = test.languages ?? [];
  let language: string | null = null;
  if (offered.length > 0) {
    const body = (await req.json().catch(() => ({}))) as { language?: string };
    language = offered.length === 1 ? offered[0]! : body.language ?? null;
    if (!language || !(offered as string[]).includes(language)) {
      return fail("Please choose a language for the exam", 400);
    }
  }

  let questions;
  try {
    questions = await freezeQuestionSet(test, { language, stream: ctx.profile.stream ?? null });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not build your question paper", 422);
  }
  if (questions.length === 0) return fail("No questions available for this exam", 422);

  const now = new Date();
  const durationMs = test.duration * 60_000;
  const windowEnd = test.schedule?.endTime ? new Date(test.schedule.endTime).getTime() : Infinity;
  const deadlineAt = new Date(Math.min(now.getTime() + durationMs, windowEnd));

  const proctoringMode =
    // MANDATORY / DISABLED come from the ALC; OPTIONAL uses the student's choice (default: proctored).
    test.proctoring.mode === "OPTIONAL"
      ? enrollment?.proctoringChoice === "DISABLED"
        ? "DISABLED"
        : "MANDATORY"
      : test.proctoring.mode;

  const attempt = await ExamAttempt.create({
    test: test._id,
    student: ctx.user.id,
    enrollment: enrollment!._id,
    center: test.center,
    status: "IN_PROGRESS",
    questions,
    proctoringMode,
    startedAt: now,
    deadlineAt,
    durationMinutes: test.duration,
    language,
  });

  await audit({
    actorId: ctx.user.id,
    actorRole: "STUDENT",
    action: "EXAM_STARTED",
    entityType: "ExamAttempt",
    entityId: attempt._id.toString(),
    metadata: { test: testId, questions: questions.length, language },
    ip: clientIp(req),
  });

  return ok(withStudent(await projectAttempt(attempt, test.name)), 201);
});
