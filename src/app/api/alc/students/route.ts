import { connectDB } from "@/lib/db";
import { StudentProfile } from "@/models/StudentProfile";
import { User } from "@/models/User";
import { requireAlcContext } from "@/lib/alc";
import { ok, handleRoute } from "@/lib/api";

/** Students associated with this ALC center. */
export const GET = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const statusFilter = url.searchParams.get("status");

  await connectDB();
  const profFilter: Record<string, unknown> = { center: ctx.centerId };
  if (statusFilter) profFilter.centerStatus = statusFilter;

  const profiles = await StudentProfile.find(profFilter)
    .populate<{ user: { name: string; email?: string; mobile?: string; isActive: boolean; image?: { url: string } } }>(
      "user",
      "name email mobile isActive image"
    )
    .sort({ createdAt: -1 })
    .lean();

  let items = profiles.map((p) => {
    const u = p.user as { _id?: unknown; name?: string; email?: string; mobile?: string; isActive?: boolean; image?: { url?: string } } | null;
    return {
      _id: String(p._id),
      userId: String((u as { _id?: unknown })?._id ?? p.user),
      name: u?.name ?? "—",
      email: u?.email ?? null,
      mobile: u?.mobile ?? null,
      isActive: u?.isActive ?? true,
      image: u?.image?.url ?? null,
      class: p.class,
      stream: p.stream ?? null,
      schoolName: p.schoolName,
      centerStatus: p.centerStatus,
    };
  });

  if (search) {
    const s = search.toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        (i.email ?? "").toLowerCase().includes(s) ||
        (i.mobile ?? "").includes(s)
    );
  }

  return ok({ items });
});
