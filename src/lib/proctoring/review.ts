import { ProctoringSession } from "@/models/ProctoringSession";
import { ProctoringEvent } from "@/models/ProctoringEvent";
import { ProctoringEvidence } from "@/models/ProctoringEvidence";
import "@/models/User";
import "@/models/Test";
import "@/models/ALCCenter";

type Pop = { name?: string; email?: string } | null;

export async function listSessions(filter: Record<string, unknown>) {
  const sessions = await ProctoringSession.find(filter)
    .sort({ updatedAt: -1 })
    .limit(300)
    .populate("student", "name email")
    .populate("test", "name")
    .populate("center", "name")
    .lean();
  return sessions.map((s) => ({
    attemptId: String(s.attempt),
    student: (s.student as Pop)?.name ?? "—",
    email: (s.student as Pop)?.email ?? null,
    test: (s.test as Pop)?.name ?? "Examination",
    center: (s.center as Pop)?.name ?? null,
    mode: s.mode,
    status: s.status,
    warnings: s.warnings,
    maxWarnings: s.maxWarnings,
    isFlagged: s.isFlagged,
    counters: s.counters,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
  }));
}

/** Full review payload for one attempt. `centerId` scopes access for ALC users. */
export async function loadReview(attemptId: string, centerId?: string) {
  const session = await ProctoringSession.findOne({ attempt: attemptId, ...(centerId ? { center: centerId } : {}) })
    .populate("student", "name email image")
    .populate("test", "name")
    .populate("center", "name")
    .lean();
  if (!session) return null;
  const [events, evidence] = await Promise.all([
    ProctoringEvent.find({ attempt: attemptId }).sort({ serverTime: 1 }).limit(1000).lean(),
    ProctoringEvidence.find({ attempt: attemptId }).sort({ capturedAt: 1 }).limit(1000).lean(),
  ]);
  const stu = session.student as (Pop & { image?: { url?: string } | null }) | null;
  return {
    session: {
      student: stu?.name ?? "—",
      email: stu?.email ?? null,
      profileImage: stu?.image?.url ?? null,
      test: (session.test as Pop)?.name ?? "Examination",
      center: (session.center as Pop)?.name ?? null,
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
    events: events.map((e) => ({ type: e.type, severity: e.severity, metadata: e.metadata, at: e.serverTime })),
    evidence: evidence.map((e) => ({
      category: e.category,
      url: e.cloudinary.url,
      capturedAt: e.capturedAt,
      reason: (e.analysis as { reason?: string } | null)?.reason ?? null,
    })),
  };
}
