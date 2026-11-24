import { requireSuperAdmin } from "@/lib/auth-helpers";
import { handleRoute } from "@/lib/api";
import { resultAnswers } from "@/lib/results-api";

export const GET = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const { resultId } = await (ctxArg as { params: Promise<{ resultId: string }> }).params;
  return resultAnswers(resultId, null);
});
