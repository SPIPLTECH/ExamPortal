import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { passwordSchema, objectIdSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum(["RESET_PASSWORD", "TOGGLE_ACTIVE", "ASSIGN_CENTER"]),
  newPassword: passwordSchema.optional(),
  centerId: objectIdSchema.nullable().optional(),
});

export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  const parsed = await parseBody(req, actionSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  const user = await User.findOne({ _id: id, role: "STUDENT" });
  if (!user) return fail("Student not found", 404);

  if (d.action === "RESET_PASSWORD") {
    if (!d.newPassword) return fail("newPassword is required", 422);
    user.passwordHash = await hashPassword(d.newPassword);
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await user.save();
  } else if (d.action === "TOGGLE_ACTIVE") {
    user.isActive = !user.isActive;
    await user.save();
  } else if (d.action === "ASSIGN_CENTER") {
    await StudentProfile.updateOne(
      { user: user._id },
      {
        center: d.centerId ?? null,
        centerStatus: d.centerId ? "VERIFIED" : "UNASSIGNED",
      }
    );
  }

  await audit({
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: `STUDENT_${d.action}`,
    entityType: "User",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id, action: d.action, isActive: user.isActive });
});

export const DELETE = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await (ctxArg as Ctx).params;

  await connectDB();
  const user = await User.findOneAndDelete({ _id: id, role: "STUDENT" });
  if (!user) return fail("Student not found", 404);
  await StudentProfile.deleteOne({ user: id });

  await audit({
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: "STUDENT_DELETED",
    entityType: "User",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id });
});
