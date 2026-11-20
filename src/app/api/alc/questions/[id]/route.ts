import { connectDB } from "@/lib/db";
import { Question } from "@/models/Question";
import { questionSchema } from "@/lib/validations";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  const parsed = await parseBody(req, questionSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  // Ownership is enforced by scoping the update to this center.
  const updated = await Question.findOneAndUpdate(
    { _id: id, center: ctx.centerId },
    { ...d, stream: d.class >= 11 ? d.stream ?? null : null },
    { new: true }
  );
  if (!updated) return fail("Question not found", 404);

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "QUESTION_UPDATED",
    entityType: "Question",
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
  const deleted = await Question.findOneAndDelete({ _id: id, center: ctx.centerId });
  if (!deleted) return fail("Question not found", 404);

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "QUESTION_DELETED",
    entityType: "Question",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id });
});
