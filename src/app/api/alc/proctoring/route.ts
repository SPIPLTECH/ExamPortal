import { connectDB } from "@/lib/db";
import { requireAlcContext } from "@/lib/alc";
import { ok, handleRoute } from "@/lib/api";
import { listSessions } from "@/lib/proctoring/review";

/** Proctoring sessions of THIS center's students only. */
export const GET = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const url = new URL(req.url);
  const filter: Record<string, unknown> = { center: ctx.centerId };
  if (url.searchParams.get("testId")) filter.test = url.searchParams.get("testId");
  if (url.searchParams.get("status")) filter.status = url.searchParams.get("status");
  await connectDB();
  return ok({ items: await listSessions(filter) });
});
