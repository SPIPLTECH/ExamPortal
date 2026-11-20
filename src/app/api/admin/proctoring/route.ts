import { connectDB } from "@/lib/db";
import { ProctoringSession } from "@/models/ProctoringSession";
import "@/models/User";
import "@/models/Test";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, handleRoute } from "@/lib/api";

/** List proctoring sessions for review (optionally by test or status). */
export const GET = handleRoute(async (req: Request) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const testId = url.searchParams.get("testId");
  const status = url.searchParams.get("status");
  const filter: Record<string, unknown> = {};
  if (testId) filter.test = testId;
  if (status) filter.status = status;

  await connectDB();
  const sessions = await ProctoringSession.find(filter)
    .sort({ warnings: -1, updatedAt: -1 })
    .limit(200)
    .populate<{ student: { name: string; email?: string } }>("student", "name email")
    .populate<{ test: { name: string } }>("test", "name")
    .lean();

  return ok({
    items: sessions.map((s) => ({
      attemptId: String(s.attempt),
      student: (s.student as { name?: string } | null)?.name ?? "—",
      email: (s.student as { email?: string } | null)?.email ?? null,
      test: (s.test as { name?: string } | null)?.name ?? "Examination",
      mode: s.mode,
      status: s.status,
      warnings: s.warnings,
      maxWarnings: s.maxWarnings,
      isFlagged: s.isFlagged,
      counters: s.counters,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    })),
  });
});
