import { connectDB } from "@/lib/db";
import { ALCCenter } from "@/models/ALCCenter";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { createCenterSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { generateExamCode } from "@/lib/exam-code";
import { addMonths, sendCenterCredentials } from "@/lib/emails";
import { env } from "@/lib/env";

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

  // Login username + expiry live on the center's ALC_CENTER user.
  const centerIds = centers.map((c) => c._id);
  const logins = await User.find(
    { role: "ALC_CENTER", center: { $in: centerIds } },
    { center: 1, username: 1, loginExpiresAt: 1 }
  ).lean();
  const loginMap = new Map(logins.map((u) => [String(u.center), u]));

  return ok({
    items: centers.map((c) => {
      const login = loginMap.get(String(c._id));
      return {
        _id: String(c._id),
        name: c.name,
        code: c.code,
        email: c.email,
        owner: c.owner ?? null,
        proctoringEnabled: c.proctoringEnabled,
        questionDbMode: c.questionDbMode,
        username: login?.username ?? null,
        loginExpiresAt: login?.loginExpiresAt ?? null,
        isActive: c.isActive,
        students: countMap.get(String(c._id)) ?? 0,
        createdAt: c.createdAt,
      };
    }),
  });
});

export const POST = handleRoute(async (req: Request) => {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;

  const parsed = await parseBody(req, createCenterSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  // Internal center code is generated automatically (unique).
  const code = await generateExamCode();
  if (await User.exists({ username: d.username })) return fail("That username is already taken", 409);

  const center = await ALCCenter.create({
    name: d.name,
    code,
    email: d.email || null,
    address: d.address || null,
    owner: { name: d.ownerName, email: d.ownerEmail, phone: d.ownerPhone },
    proctoringEnabled: d.proctoringEnabled,
    questionDbMode: d.questionDbMode,
    isActive: true,
    createdBy: session.user.id,
  });

  // Username is the login identity; email/mobile are optional alternates and are
  // unique-indexed, so only attach them to the login when still free.
  const loginEmail = (await User.exists({ email: d.ownerEmail })) ? null : d.ownerEmail;
  const loginMobile = (await User.exists({ mobile: d.ownerPhone })) ? null : d.ownerPhone;
  const loginExpiresAt = addMonths(new Date(), d.expiryMonths);
  await User.create({
    name: d.ownerName,
    username: d.username,
    email: loginEmail,
    mobile: loginMobile,
    passwordHash: await hashPassword(d.password),
    role: "ALC_CENTER",
    center: center._id,
    loginExpiresAt,
    isActive: true,
    createdBy: session.user.id,
  });

  // Mail the credentials to the center and owner mailboxes (best-effort).
  const emailed = await sendCenterCredentials({
    centerName: d.name,
    recipients: [d.email, d.ownerEmail],
    username: d.username,
    password: d.password,
    loginUrl: `${env.APP_URL}/login`,
    expiresAt: loginExpiresAt,
  }).catch(() => false);

  await audit({
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: "CENTER_CREATED",
    entityType: "ALCCenter",
    entityId: center._id.toString(),
    metadata: { code, username: d.username, expiryMonths: d.expiryMonths },
    ip: clientIp(req),
  });

  return ok({ id: center._id.toString(), code, username: d.username, loginExpiresAt, emailed }, 201);
});
