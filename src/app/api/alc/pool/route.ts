import { requireAlcContext } from "@/lib/alc";
import { getPoolAvailability } from "@/lib/pool";
import { ok, fail, handleRoute } from "@/lib/api";
import { resolveRules } from "@/lib/distribution";
import type { Stream } from "@/lib/constants";

/** Live question-bank availability + default distribution for a class/stream. */
export const GET = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  const url = new URL(req.url);
  const cls = Number(url.searchParams.get("class"));
  const stream = (url.searchParams.get("stream") as Stream | null) || null;
  if (!cls || cls < 5 || cls > 12) return fail("Invalid class", 400);

  const availability = await getPoolAvailability(ctx.centerId, cls, stream);
  const defaultRules = resolveRules(cls, undefined);
  return ok({ availability, defaultRules });
});
