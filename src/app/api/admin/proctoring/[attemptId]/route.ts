import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, fail, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { loadReview } from "@/lib/proctoring/review";

export const GET = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session: admin } = await requireSuperAdmin();
  if (error) return error;
  const { attemptId } = await (ctxArg as { params: Promise<{ attemptId: string }> }).params;
  await connectDB();
  const data = await loadReview(attemptId);
  if (!data) return fail("No proctoring session for this attempt", 404);
  await audit({
    actorId: admin.user.id,
    actorRole: "SUPER_ADMIN",
    action: "PROCTORING_REVIEWED",
    entityType: "ExamAttempt",
    entityId: attemptId,
    ip: clientIp(req),
  });
  return ok(data);
});
