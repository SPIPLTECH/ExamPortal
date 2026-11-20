import { z } from "zod";
import { connectDB } from "@/lib/db";
import { StudentProfile } from "@/models/StudentProfile";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

const schema = z.object({ action: z.enum(["VERIFY", "REMOVE"]) });

/** Verify a pending center association, or remove a student from this center. */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  await connectDB();
  const profile = await StudentProfile.findOne({ _id: id, center: ctx.centerId });
  if (!profile) return fail("Student not found at this center", 404);

  if (parsed.data.action === "VERIFY") {
    profile.centerStatus = "VERIFIED";
  } else {
    profile.center = null;
    profile.centerStatus = "UNASSIGNED";
  }
  await profile.save();

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: `STUDENT_${parsed.data.action}`,
    entityType: "StudentProfile",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id, centerStatus: profile.centerStatus });
});
