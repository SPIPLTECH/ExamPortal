import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question } from "@/models/Question";
// Register referenced models so `.populate()` can resolve their schemas.
import "@/models/ALCCenter";
import "@/models/User";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, fail, handleRoute } from "@/lib/api";

/** Full test preview for the admin: settings + the test's own question pool (with answers). */
export const GET = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  await connectDB();
  const test = await Test.findById(id)
    .populate<{ center: { name: string; code: string } }>("center", "name code")
    .populate<{ createdBy: { name: string; email: string } }>("createdBy", "name email")
    .lean();
  if (!test) return fail("Test not found", 404);

  // The test's own questions (admin may inspect questions AND answers).
  const sample = await Question.find({ test: id, isActive: true }).limit(500).lean();
  const poolCount = sample.length;

  return ok({ test, poolCount, sample });
});
