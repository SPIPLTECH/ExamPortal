import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ProctoringSession } from "@/models/ProctoringSession";
import { ProctoringEvent } from "@/models/ProctoringEvent";
import { requireStudentContext } from "@/lib/student";
import { ok, fail, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { aiEnabled } from "@/lib/proctoring/ai";

/** Record proctoring consent and open (or resume) the monitoring session. */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: ctx.user.id });
  if (!attempt) return fail("No active attempt", 404);
  if (attempt.status !== "IN_PROGRESS") return fail("This exam is no longer active", 409);
  if (attempt.proctoringMode === "DISABLED") return fail("Proctoring is not enabled for this attempt", 400);

  const test = await Test.findById(testId).select("proctoring").lean();
  const maxWarnings = Math.max(1, test?.proctoring?.maxTabSwitches ?? 3);

  let session = await ProctoringSession.findOne({ attempt: attempt._id });
  if (!session) {
    session = await ProctoringSession.create({
      attempt: attempt._id,
      student: ctx.user.id,
      test: testId,
      center: attempt.center,
      mode: attempt.proctoringMode,
      status: "ACTIVE",
      consentAt: new Date(),
      consentVersion: "v1",
      startedAt: new Date(),
      maxWarnings,
    });
    await ProctoringEvent.create({
      session: session._id,
      attempt: attempt._id,
      type: "CONSENT_GIVEN",
      severity: "INFO",
      serverTime: new Date(),
    });
  } else if (session.status === "PENDING") {
    session.status = "ACTIVE";
    session.consentAt = new Date();
    session.startedAt = new Date();
    await session.save();
  }

  await audit({
    actorId: ctx.user.id,
    actorRole: "STUDENT",
    action: "PROCTORING_CONSENT",
    entityType: "ProctoringSession",
    entityId: session._id.toString(),
    ip: clientIp(req),
  });

  return ok({
    sessionId: session._id.toString(),
    warnings: session.warnings,
    maxWarnings: session.maxWarnings,
    status: session.status,
    aiEnabled: aiEnabled(),
  });
});
