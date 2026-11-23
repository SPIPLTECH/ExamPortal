import { connectDB } from "@/lib/db";
import { School } from "@/models/School";
import { StudentProfile } from "@/models/StudentProfile";
import { requireAlcContext } from "@/lib/alc";
import { schoolSchema } from "@/lib/validations";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  const parsed = await parseBody(req, schoolSchema.partial());
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  const school = await School.findOne({ _id: id, center: ctx.centerId });
  if (!school) return fail("School not found", 404);

  if (d.name !== undefined && d.name !== school.name) {
    if (await School.exists({ center: ctx.centerId, name: d.name, _id: { $ne: school._id } }))
      return fail("A school with this name already exists", 409);
    school.name = d.name;
  }
  if (d.address !== undefined) school.address = d.address || null;
  if (d.phone !== undefined) school.phone = d.phone || null;
  await school.save();

  await audit({
    actorId: ctx.user.id, actorRole: "ALC_CENTER", action: "SCHOOL_UPDATED",
    entityType: "School", entityId: id, ip: clientIp(req),
  });
  return ok({ id });
});

export const DELETE = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  await connectDB();
  const school = await School.findOne({ _id: id, center: ctx.centerId });
  if (!school) return fail("School not found", 404);

  const inUse = await StudentProfile.countDocuments({ school: school._id });
  if (inUse > 0) return fail(`Cannot delete: ${inUse} student(s) belong to this school`, 409);

  await school.deleteOne();
  await audit({
    actorId: ctx.user.id, actorRole: "ALC_CENTER", action: "SCHOOL_DELETED",
    entityType: "School", entityId: id, ip: clientIp(req),
  });
  return ok({ id });
});
