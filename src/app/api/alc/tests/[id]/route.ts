import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { testSchema } from "@/lib/validations";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { getTestPoolCount } from "@/lib/pool";
import { audit, clientIp } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId }).lean();
  if (!test) return fail("Test not found", 404);

  const poolCount = await getTestPoolCount(id);
  return ok({ test, poolCount });
});

export const PATCH = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  const parsed = await parseBody(req, testSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId });
  if (!test) return fail("Test not found", 404);

  // A test is editable in any state (including published) per requirements.
  Object.assign(test, d, {
    targetStream: d.targetClass >= 11 ? d.targetStream ?? null : null,
  });
  // Re-editing a change-requested test returns it to draft for re-submission.
  if (test.reviewStatus === "CHANGES_REQUESTED") test.reviewStatus = "DRAFT";
  await test.save();

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_UPDATED",
    entityType: "Test",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id });
});

export const DELETE = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId });
  if (!test) return fail("Test not found", 404);
  if (["SCHEDULED", "ACTIVE", "COMPLETED"].includes(test.status)) {
    return fail("A published/scheduled test cannot be deleted", 409);
  }
  // Delete the test and its owned questions.
  const { Question } = await import("@/models/Question");
  await Question.deleteMany({ test: id });
  await test.deleteOne();

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_DELETED",
    entityType: "Test",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id });
});
