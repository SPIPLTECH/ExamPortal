import mongoose from "mongoose";
import { env } from "./env";

/**
 * Mongoose connection with the standard Next.js/serverless global-cache pattern
 * so hot-reloads and lambda invocations reuse a single connection instead of
 * opening a new one per request.
 */

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  _mongoose?: MongooseCache;
};

const cache: MongooseCache =
  globalForMongoose._mongoose ?? { conn: null, promise: null };

if (!globalForMongoose._mongoose) {
  globalForMongoose._mongoose = cache;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      // Pin a dedicated database so data never lands in Atlas's shared `test`
      // db (overrides any db path in the URI). Configurable via MONGODB_DB.
      dbName: process.env.MONGODB_DB || "exam_portal",
      // Fail fast if Atlas is unreachable rather than hanging requests.
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

/** Ensure the connection is open and all model indexes are built. Call in seed/scripts. */
export async function connectAndSyncIndexes(): Promise<typeof mongoose> {
  const conn = await connectDB();
  await Promise.all(
    Object.values(conn.models).map((m) => m.syncIndexes().catch(() => undefined))
  );
  return conn;
}
