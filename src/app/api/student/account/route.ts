import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { ALCCenter } from "@/models/ALCCenter";
import { requireStudentContext } from "@/lib/student";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { ok, fail, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

export const GET = handleRoute(async () => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;

  await connectDB();
  const user = await User.findById(ctx.user.id).select("name email mobile image").lean();
  const center = ctx.profile.center
    ? await ALCCenter.findById(ctx.profile.center).select("name code").lean()
    : null;

  return ok({
    user: {
      name: user?.name,
      email: user?.email ?? null,
      mobile: user?.mobile ?? null,
      image: user?.image?.url ?? null,
    },
    profile: {
      class: ctx.profile.class,
      stream: ctx.profile.stream ?? null,
      schoolName: ctx.profile.schoolName,
      center: center ? { name: center.name, code: center.code } : null,
      centerStatus: ctx.profile.centerStatus,
      mscit: ctx.profile.mscit,
    },
  });
});

export const PATCH = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;

  const form = await req.formData();
  const name = (form.get("name") as string | null)?.trim();
  const schoolName = (form.get("schoolName") as string | null)?.trim();
  const photo = form.get("photo");

  await connectDB();
  const user = await User.findById(ctx.user.id);
  if (!user) return fail("User not found", 404);

  if (name && name.length >= 2) user.name = name;

  if (photo && photo instanceof File && photo.size > 0) {
    if (!env.cloudinary.configured) return fail("Image uploads are not configured", 503);
    const buf = Buffer.from(await photo.arrayBuffer());
    const uploaded = await uploadImage(buf, { folder: "exam-portal/students", mimeType: photo.type });
    if (user.image?.publicId) await deleteImage(user.image.publicId).catch(() => {});
    user.image = uploaded;
  }
  await user.save();

  if (schoolName && schoolName.length >= 2) {
    await StudentProfile.updateOne({ user: ctx.user.id }, { schoolName });
  }

  await audit({
    actorId: ctx.user.id,
    actorRole: "STUDENT",
    action: "PROFILE_UPDATED",
    entityType: "User",
    entityId: ctx.user.id,
    ip: clientIp(req),
  });

  return ok({ updated: true, image: user.image?.url ?? null });
});
