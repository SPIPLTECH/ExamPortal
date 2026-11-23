import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question } from "@/models/Question";
import { questionSchema } from "@/lib/validations";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { markNeedsReview } from "@/lib/test-review";
import { audit, clientIp } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

async function ownedTest(centerId: string, id: string) {
  await connectDB();
  return Test.findOne({ _id: id, center: centerId });
}

/** List the questions in this test's own pool. */
export const GET = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  const test = await ownedTest(ctx.centerId, id);
  if (!test) return fail("Test not found", 404);

  const items = await Question.find({ test: id }).sort({ createdAt: 1 }).lean();
  return ok({ items, total: items.length });
});

/** Add one question manually to this test's pool. */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  const test = await ownedTest(ctx.centerId, id);
  if (!test) return fail("Test not found", 404);

  const parsed = await parseBody(req, questionSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  const q = await Question.create({
    ...d,
    class: test.targetClass,
    stream: test.targetClass >= 11 ? test.targetStream ?? null : null,
    center: ctx.centerId,
    test: id,
    createdBy: ctx.user.id,
  });

  await markNeedsReview(id);

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_QUESTION_ADDED",
    entityType: "Test",
    entityId: id,
    metadata: { questionId: q._id.toString() },
    ip: clientIp(req),
  });

  return ok({ id: q._id.toString() }, 201);
});
