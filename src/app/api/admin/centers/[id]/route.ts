import { connectDB } from "@/lib/db";
import { ALCCenter } from "@/models/ALCCenter";
import { User } from "@/models/User";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { updateCenterSchema } from "@/lib/validations";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  const parsed = await parseBody(req, updateCenterSchema);
  if (parsed.error) return parsed.error;

  await connectDB();
  const center = await ALCCenter.findById(id);
  if (!center) return fail("Center not found", 404);

  const d = parsed.data;
  if (d.name !== undefined) center.name = d.name;
  if (d.email !== undefined) center.email = d.email || null;
  if (d.address !== undefined) center.address = d.address || null;
  if (d.proctoringEnabled !== undefined) center.proctoringEnabled = d.proctoringEnabled;
  if (d.questionDbMode !== undefined) center.questionDbMode = d.questionDbMode;
  if (d.isActive !== undefined) center.isActive = d.isActive;
  if (d.ownerName !== undefined || d.ownerEmail !== undefined || d.ownerPhone !== undefined) {
    center.owner = {
      name: d.ownerName ?? center.owner?.name ?? null,
      email: (d.ownerEmail || null) ?? center.owner?.email ?? null,
      phone: (d.ownerPhone || null) ?? center.owner?.phone ?? null,
    };
  }
  await center.save();

  // Extending validity resets the center login's expiry from now.
  if (d.expiryMonths !== undefined) {
    const { addMonths } = await import("@/lib/emails");
    await User.updateMany(
      { center: center._id, role: "ALC_CENTER" },
      { loginExpiresAt: addMonths(new Date(), d.expiryMonths) }
    );
  }

  await audit({
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: "CENTER_UPDATED",
    entityType: "ALCCenter",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id });
});

/** Toggle active/inactive. Deactivating also disables the center's logins. */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  await connectDB();
  const center = await ALCCenter.findById(id);
  if (!center) return fail("Center not found", 404);

  center.isActive = !center.isActive;
  await center.save();
  await User.updateMany({ center: center._id, role: "ALC_CENTER" }, { isActive: center.isActive });

  await audit({
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: center.isActive ? "CENTER_ACTIVATED" : "CENTER_DEACTIVATED",
    entityType: "ALCCenter",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id, isActive: center.isActive });
});
