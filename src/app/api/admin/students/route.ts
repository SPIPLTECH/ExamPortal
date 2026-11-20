import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { ALCCenter } from "@/models/ALCCenter";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, handleRoute } from "@/lib/api";

export const GET = handleRoute(async (req: Request) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

  const userFilter: Record<string, unknown> = { role: "STUDENT" };
  if (search) userFilter.$or = [
    { name: { $regex: search, $options: "i" } },
    { email: { $regex: search, $options: "i" } },
    { mobile: { $regex: search, $options: "i" } },
  ];

  await connectDB();
  const [users, total] = await Promise.all([
    User.find(userFilter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(userFilter),
  ]);

  const ids = users.map((u) => u._id);
  const profiles = await StudentProfile.find({ user: { $in: ids } })
    .populate<{ center: { name: string; code: string } }>("center", "name code")
    .lean();
  const profMap = new Map(profiles.map((p) => [String(p.user), p]));

  return ok({
    items: users.map((u) => {
      const p = profMap.get(String(u._id));
      return {
        _id: String(u._id),
        name: u.name,
        email: u.email ?? null,
        mobile: u.mobile ?? null,
        isActive: u.isActive,
        image: u.image?.url ?? null,
        class: p?.class ?? null,
        stream: p?.stream ?? null,
        schoolName: p?.schoolName ?? null,
        center: p?.center ? { name: (p.center as { name: string }).name, code: (p.center as { code: string }).code } : null,
        centerStatus: p?.centerStatus ?? "UNASSIGNED",
      };
    }),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});
