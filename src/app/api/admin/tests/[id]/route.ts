import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question } from "@/models/Question";
// Register referenced models so `.populate()` can resolve their schemas.
import "@/models/ALCCenter";
import "@/models/User";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, fail, handleRoute } from "@/lib/api";
import { getPoolAvailability } from "@/lib/pool";

/** Full test preview for the admin: settings + pool availability + a question sample. */
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

  const availability = await getPoolAvailability(
    String((test.center as { _id?: unknown })?._id ?? test.center),
    test.targetClass,
    test.targetStream ?? null
  );

  // Admins may inspect questions AND answers (sample from the eligible pool).
  const sampleFilter: Record<string, unknown> = {
    center: (test.center as { _id?: unknown })?._id ?? test.center,
    class: test.targetClass,
    isActive: true,
  };
  if (test.targetClass >= 11 && test.targetStream) {
    sampleFilter.$or = [{ stream: test.targetStream }, { stream: null }];
  }
  const sample = await Question.find(sampleFilter).limit(50).lean();

  return ok({ test, availability, sample });
});
