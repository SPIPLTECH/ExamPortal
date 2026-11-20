import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
  configured = true;
}

export type UploadResult = { url: string; publicId: string };

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload an image buffer to Cloudinary under a folder.
 * Validates mime-type and size before sending (secure file upload validation).
 */
export async function uploadImage(
  buffer: Buffer,
  opts: { folder: string; mimeType: string; publicId?: string }
): Promise<UploadResult> {
  ensureConfigured();

  if (!ALLOWED_IMAGE_TYPES.includes(opts.mimeType)) {
    throw new Error("Unsupported image type. Use JPEG, PNG, WEBP or GIF.");
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image too large. Maximum size is 5 MB.");
  }

  return new Promise<UploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder,
        public_id: opts.publicId,
        resource_type: "image",
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  if (!publicId) return;
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId);
}

export const cloudinaryConstraints = { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES };
