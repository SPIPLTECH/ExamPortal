import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, handleRoute } from "@/lib/api";
import { validateTestFeasibility } from "@/lib/pool";
import { audit, clientIp } from "@/lib/audit";

/** Submit a draft test for super-admin approval (gated on pool feasibility). */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId });
  if (!test) return fail("Test not found", 404);
  if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(test.reviewStatus)) {
    return fail(`This test is already ${test.reviewStatus.toLowerCase()}`, 409);
  }

  // The test's own pool must have at least `totalQuestions` to serve each student.
  const feasibility = await validateTestFeasibility({
    _id: String(test._id),
    totalQuestions: test.totalQuestions,
  });
  if (!feasibility.ok) {
    return fail(`Cannot submit: ${feasibility.error}`, 422);
  }

  test.reviewStatus = "SUBMITTED";
  test.submittedAt = new Date();
  test.rejectionReason = null;
  await test.save();

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_SUBMITTED",
    entityType: "Test",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id, reviewStatus: "SUBMITTED" });
});
