import { requireSuperAdmin } from "@/lib/auth-helpers";
import { handleRoute } from "@/lib/api";
import { resultsList } from "@/lib/results-api";

export const GET = handleRoute(async (req: Request) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  return resultsList(req, null);
});
