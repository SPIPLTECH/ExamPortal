import { requireAlcContext } from "@/lib/alc";
import { uploadImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { ok, fail, handleRoute } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024;

/** Upload a question/option image to Cloudinary and return its URL. */
export const POST = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  if (!env.cloudinary.configured) return fail("Image uploads are not configured", 503);

  const form = await req.formData();
  const file = form.get("image");
  if (!file || !(file instanceof File)) return fail("No image uploaded", 400);
  if (file.size > MAX_BYTES) return fail("Image too large (max 5 MB)", 400);

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadImage(buf, {
    folder: `exam-portal/questions/${ctx.centerId}`,
    mimeType: file.type || "image/jpeg",
  });

  return ok({ url: uploaded.url, publicId: uploaded.publicId });
});
