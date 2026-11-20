import { connectDB } from "@/lib/db";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, handleRoute } from "@/lib/api";
import { loadReview } from "@/lib/proctoring/review";

/** Review one attempt — only if it belongs to the caller's center. */
export const GET = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { attemptId } = await (ctxArg as { params: Promise<{ attemptId: string }> }).params;
  await connectDB();
  const data = await loadReview(attemptId, ctx.centerId);
  if (!data) return fail("No proctoring session for this attempt", 404);
  return ok(data);
});
