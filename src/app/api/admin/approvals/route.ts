import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
// Register referenced models so `.populate()` can resolve their schemas.
import "@/models/ALCCenter";
import "@/models/User";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, handleRoute } from "@/lib/api";

/** List tests awaiting review (default SUBMITTED), newest first. */
export const GET = handleRoute(async (req: Request) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get("reviewStatus") ?? "SUBMITTED";

  await connectDB();
  const items = await Test.find({ reviewStatus: status })
    .sort({ submittedAt: -1, createdAt: -1 })
    .populate<{ center: { name: string; code: string } }>("center", "name code")
    .populate<{ createdBy: { name: string } }>("createdBy", "name")
    .lean();

  return ok({ items });
});
