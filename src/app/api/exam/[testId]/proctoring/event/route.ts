import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ProctoringSession } from "@/models/ProctoringSession";
import { ProctoringEvent } from "@/models/ProctoringEvent";
import { requireStudentContext } from "@/lib/student";
import { applyPolicy } from "@/lib/proctoring";
import { finalizeAttempt } from "@/lib/exam-engine";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";

const schema = z.object({
  eventType: z.string().min(1).max(64),
  severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("INFO"),
  isSimulated: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  clientTimestamp: z.string().optional(),
  seq: z.number().optional(),
});

export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: ctx.user.id });
  if (!attempt) return fail("No active attempt", 404);

  const session = await ProctoringSession.findOne({ attempt: attempt._id });
  if (!session) return fail("No proctoring session", 404);

  // If already ended, tell the client to leave.
  if (session.status !== "ACTIVE" || attempt.status !== "IN_PROGRESS") {
    return ok({
      policyResult: {
        currentWarnings: session.warnings,
        maxWarnings: session.maxWarnings,
        isFlagged: session.isFlagged,
        warningIssued: false,
        message: null,
        terminated: true,
      },
    });
  }

  const policyResult = applyPolicy(session, d.eventType);

  await ProctoringEvent.create({
    session: session._id,
    attempt: attempt._id,
    type: d.eventType,
    severity: d.severity,
    seq: d.seq ?? 0,
    metadata: { ...(d.metadata ?? {}), isSimulated: d.isSimulated ?? false },
    clientTime: d.clientTimestamp ? new Date(d.clientTimestamp) : null,
    serverTime: new Date(),
  }).catch(() => {}); // de-dup index may reject retries; ignore

  await session.save();

  if (policyResult.terminated) {
    attempt.terminationReason = "Proctoring: exceeded allowed violations";
    await finalizeAttempt(attempt, "TERMINATED");
  }

  return ok({ policyResult });
});
