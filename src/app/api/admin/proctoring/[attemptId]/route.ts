import { connectDB } from "@/lib/db";
import { ProctoringSession } from "@/models/ProctoringSession";
import { ProctoringEvent } from "@/models/ProctoringEvent";
import { ProctoringEvidence } from "@/models/ProctoringEvidence";
import "@/models/User";
import "@/models/Test";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, fail, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

/** Full proctoring review for one attempt: session, events and evidence. */
export const GET = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session: admin } = await requireSuperAdmin();
  if (error) return error;
  const { attemptId } = await (ctxArg as { params: Promise<{ attemptId: string }> }).params;

  await connectDB();
  const session = await ProctoringSession.findOne({ attempt: attemptId })
    .populate<{ student: { name: string; email?: string } }>("student", "name email")
    .populate<{ test: { name: string } }>("test", "name")
    .lean();
  if (!session) return fail("No proctoring session for this attempt", 404);

  const [events, evidence] = await Promise.all([
    ProctoringEvent.find({ attempt: attemptId }).sort({ serverTime: 1 }).limit(500).lean(),
    ProctoringEvidence.find({ attempt: attemptId }).sort({ capturedAt: 1 }).limit(500).lean(),
  ]);

  // Staff access to proctoring recordings is itself audited.
  await audit({
    actorId: admin.user.id,
    actorRole: "SUPER_ADMIN",
    action: "PROCTORING_REVIEWED",
    entityType: "ExamAttempt",
    entityId: attemptId,
    ip: clientIp(req),
  });

  return ok({
    session: {
      student: (session.student as { name?: string } | null)?.name ?? "—",
      email: (session.student as { email?: string } | null)?.email ?? null,
      test: (session.test as { name?: string } | null)?.name ?? "Examination",
      mode: session.mode,
      status: session.status,
      warnings: session.warnings,
      maxWarnings: session.maxWarnings,
      counters: session.counters,
      identityBaseline: session.identityBaseline?.url ?? null,
      terminationReason: session.terminationReason ?? null,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
    events: events.map((e) => ({
      type: e.type,
      severity: e.severity,
      metadata: e.metadata,
      at: e.serverTime,
    })),
    evidence: evidence.map((e) => ({
      category: e.category,
      url: e.cloudinary.url,
      capturedAt: e.capturedAt,
    })),
  });
});
