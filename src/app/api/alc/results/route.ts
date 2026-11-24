import { requireAlcContext } from "@/lib/alc";
import { handleRoute } from "@/lib/api";
import { resultsList } from "@/lib/results-api";

export const GET = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  return resultsList(req, ctx.centerId);
});
