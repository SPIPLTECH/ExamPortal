import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireStudentContext } from "@/lib/student";
import { passwordSchema } from "@/lib/validations";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const POST = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  await connectDB();
  const user = await User.findById(ctx.user.id);
  if (!user) return fail("User not found", 404);

  const okCurrent = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!okCurrent) return fail("Current password is incorrect", 400);

  user.passwordHash = await hashPassword(parsed.data.newPassword);
  await user.save();

  await audit({
    actorId: ctx.user.id,
    actorRole: "STUDENT",
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: ctx.user.id,
    ip: clientIp(req),
  });

  return ok({ changed: true });
});
