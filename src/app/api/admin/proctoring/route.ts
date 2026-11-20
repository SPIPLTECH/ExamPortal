import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, handleRoute } from "@/lib/api";
import { listSessions } from "@/lib/proctoring/review";

/** All proctoring sessions across centers (optionally by test or status). */
export const GET = handleRoute(async (req: Request) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const url = new URL(req.url);
  const filter: Record<string, unknown> = {};
  if (url.searchParams.get("testId")) filter.test = url.searchParams.get("testId");
  if (url.searchParams.get("status")) filter.status = url.searchParams.get("status");
  await connectDB();
  return ok({ items: await listSessions(filter) });
});
