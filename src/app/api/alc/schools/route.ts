import { connectDB } from "@/lib/db";
import { School } from "@/models/School";
import { StudentProfile } from "@/models/StudentProfile";
import { requireAlcContext } from "@/lib/alc";
import { schoolSchema } from "@/lib/validations";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

export const GET = handleRoute(async () => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  await connectDB();
  const schools = await School.find({ center: ctx.centerId }).sort({ name: 1 }).lean();

  const counts = await StudentProfile.aggregate<{ _id: unknown; count: number }>([
    { $match: { school: { $ne: null } } },
    { $group: { _id: "$school", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return ok({
    items: schools.map((s) => ({
      _id: String(s._id),
      name: s.name,
      address: s.address,
      phone: s.phone,
      isActive: s.isActive,
      students: countMap.get(String(s._id)) ?? 0,
    })),
  });
});

export const POST = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  const parsed = await parseBody(req, schoolSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  if (await School.exists({ center: ctx.centerId, name: d.name }))
    return fail("A school with this name already exists", 409);

  const school = await School.create({
    center: ctx.centerId,
    name: d.name,
    address: d.address || null,
    phone: d.phone || null,
    createdBy: ctx.user.id,
  });

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "SCHOOL_CREATED",
    entityType: "School",
    entityId: school._id.toString(),
    ip: clientIp(req),
  });

  return ok({ id: school._id.toString() }, 201);
});
