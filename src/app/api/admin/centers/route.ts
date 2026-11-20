import { connectDB } from "@/lib/db";
import { ALCCenter } from "@/models/ALCCenter";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { createCenterSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

export const GET = handleRoute(async (req: Request) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const filter: Record<string, unknown> = {};
  if (search) filter.$or = [
    { name: { $regex: search, $options: "i" } },
    { code: { $regex: search, $options: "i" } },
  ];

  await connectDB();
  const centers = await ALCCenter.find(filter).sort({ createdAt: -1 }).lean();

  // Attach student counts per center.
  const counts = await StudentProfile.aggregate<{ _id: unknown; count: number }>([
    { $match: { center: { $ne: null } } },
    { $group: { _id: "$center", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return ok({
    items: centers.map((c) => ({
      _id: String(c._id),
      name: c.name,
      code: c.code,
      email: c.email,
      phone: c.phone,
      city: c.city,
      state: c.state,
      isActive: c.isActive,
      students: countMap.get(String(c._id)) ?? 0,
      createdAt: c.createdAt,
    })),
  });
});

export const POST = handleRoute(async (req: Request) => {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;

  const parsed = await parseBody(req, createCenterSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  const code = d.code.toUpperCase();
  if (await ALCCenter.exists({ code })) return fail("A center with this code already exists", 409);
  if (await User.exists({ email: d.adminEmail })) return fail("The admin email is already in use", 409);

  const center = await ALCCenter.create({
    name: d.name,
    code,
    email: d.email || null,
    phone: d.phone || null,
    address: d.address || null,
    city: d.city || null,
    state: d.state || null,
    capacity: d.capacity ?? null,
    isActive: true,
    createdBy: session.user.id,
  });

  await User.create({
    name: d.adminName,
    email: d.adminEmail,
    passwordHash: await hashPassword(d.adminPassword),
    role: "ALC_CENTER",
    center: center._id,
    isActive: true,
    createdBy: session.user.id,
  });

  await audit({
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: "CENTER_CREATED",
    entityType: "ALCCenter",
    entityId: center._id.toString(),
    metadata: { code },
    ip: clientIp(req),
  });

  return ok({ id: center._id.toString(), code }, 201);
});
