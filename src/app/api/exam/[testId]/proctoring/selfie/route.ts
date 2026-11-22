import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { User } from "@/models/User";
import { requireStudentContext } from "@/lib/student";
import { uploadImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { ok, fail, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

const MAX_BYTES = 2 * 1024 * 1024;

/** Save the verified pre-exam selfie as the student's exam photo (exam room, ALC and admin). */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  const form = await req.formData();
  const file = form.get("photo");
  if (!file || !(file instanceof File)) return fail("No photo uploaded", 400);
  if (file.size > MAX_BYTES) return fail("Photo too large", 400);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return fail("Unsupported image type", 400);

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: ctx.user.id });
  if (!attempt) return fail("No active attempt", 404);
  if (attempt.status !== "IN_PROGRESS") return fail("This exam is no longer active", 409);

  const buf = Buffer.from(await file.arrayBuffer());
  let image: { url: string; publicId: string };
  if (env.cloudinary.configured) {
    image = await uploadImage(buf, {
      folder: `exam-portal/selfies/${attempt._id}`,
      mimeType: file.type,
    });
  } else {
    // No Cloudinary: keep the (small, 480px) selfie inline so the feature still works.
    image = { url: `data:${file.type};base64,${buf.toString("base64")}`, publicId: "inline" };
  }

  attempt.selfieUrl = image.url;
  await attempt.save();
  await User.updateOne({ _id: ctx.user.id }, { $set: { image } });

  await audit({
    actorId: ctx.user.id,
    actorRole: "STUDENT",
    action: "SELFIE_CAPTURED",
    entityType: "ExamAttempt",
    entityId: attempt._id.toString(),
    ip: clientIp(req),
  });
  return ok({ url: image.url });
});
