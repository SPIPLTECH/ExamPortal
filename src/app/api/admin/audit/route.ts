import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import "@/models/User";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, handleRoute } from "@/lib/api";

export const GET = handleRoute(async (req: Request) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
  const action = url.searchParams.get("action")?.trim();

  const filter: Record<string, unknown> = {};
  if (action) filter.action = { $regex: action, $options: "i" };

  await connectDB();
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ actor: { name: string } }>("actor", "name")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return ok({
    items: items.map((a) => ({
      _id: String(a._id),
      actor: (a.actor as { name?: string } | null)?.name ?? "System",
      actorRole: a.actorRole,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      metadata: a.metadata,
      ip: a.ip,
      createdAt: a.createdAt,
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});
