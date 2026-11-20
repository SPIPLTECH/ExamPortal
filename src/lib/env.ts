/**
 * Centralized environment access with helpful runtime errors.
 * We intentionally do NOT throw at import time (so `next build` and tooling
 * that imports modules without a full env still work); instead each getter
 * throws a clear message the first time a missing secret is actually needed.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in exam-portal/.env (see .env.example).`
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  get MONGODB_URI() {
    return required("MONGODB_URI");
  },
  get AUTH_SECRET() {
    return required("AUTH_SECRET");
  },
  get APP_URL() {
    return optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  },
  cloudinary: {
    get cloudName() {
      return required("CLOUDINARY_CLOUD_NAME");
    },
    get apiKey() {
      return required("CLOUDINARY_API_KEY");
    },
    get apiSecret() {
      return required("CLOUDINARY_API_SECRET");
    },
    /** True when all three Cloudinary values are present (upload features gated on this). */
    get configured() {
      return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
      );
    },
  },
  /** Optional external AI proctoring service (Python face-detection). Empty = disabled. */
  get AI_SERVICE_URL() {
    return optional("AI_SERVICE_URL", "");
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
} as const;
