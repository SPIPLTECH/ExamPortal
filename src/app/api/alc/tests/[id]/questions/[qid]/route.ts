import { connectDB } from "@/lib/db";
import { Question } from "@/models/Question";
import { questionSchema } from "@/lib/validations";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string; qid: string }> };

/** Edit one question in a test's pool. */
export const PATCH = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id, qid } = await (ctxArg as Ctx).params;

  const parsed = await parseBody(req, questionSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  const updated = await Question.findOneAndUpdate(
    { _id: qid, test: id, center: ctx.centerId },
    { ...d },
    { new: true }
  );
  if (!updated) return fail("Question not found", 404);

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_QUESTION_UPDATED",
    entityType: "Test",
    entityId: id,
    metadata: { questionId: qid },
    ip: clientIp(req),
  });

  return ok({ id: qid });
});

/** Remove one question from a test's pool. */
export const DELETE = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id, qid } = await (ctxArg as Ctx).params;

  await connectDB();
  const deleted = await Question.findOneAndDelete({ _id: qid, test: id, center: ctx.centerId });
  if (!deleted) return fail("Question not found", 404);

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_QUESTION_DELETED",
    entityType: "Test",
    entityId: id,
    metadata: { questionId: qid },
    ip: clientIp(req),
  });

  return ok({ id: qid });
});
