import mongoose from "mongoose";
import { env } from "./env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  listenersBound: boolean;
};

const globalForMongoose = globalThis as unknown as { _mongoose?: MongooseCache };
const cache: MongooseCache =
  globalForMongoose._mongoose ?? { conn: null, promise: null, listenersBound: false };
if (!globalForMongoose._mongoose) globalForMongoose._mongoose = cache;

function bindListeners() {
  if (cache.listenersBound) return;
  cache.listenersBound = true;
  // When the socket drops or errors, drop the cache so the next call reconnects
  // cleanly instead of reusing a dead connection (prevents sporadic ECONNRESET).
  mongoose.connection.on("disconnected", () => {
    cache.conn = null;
    cache.promise = null;
  });
  mongoose.connection.on("error", () => {
    cache.conn = null;
    cache.promise = null;
  });
}

export async function connectDB(): Promise<typeof mongoose> {
  // Reuse only a live connection (1 = connected). A dropped one is rebuilt.
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (cache.conn && mongoose.connection.readyState !== 1) {
    cache.conn = null;
    cache.promise = null;
  }

  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    bindListeners();
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || "exam_portal",
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      // Prune sockets that have been idle for 60s so Atlas never hands us a
      // stale/reset connection from the pool.
      maxIdleTimeMS: 60000,
      // Retry transient network blips automatically (driver default, explicit here).
      retryReads: true,
      retryWrites: true,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    cache.conn = null;
    throw err;
  }
  return cache.conn;
}

export async function connectAndSyncIndexes(): Promise<typeof mongoose> {
  const conn = await connectDB();
  await Promise.all(Object.values(conn.models).map((m) => m.syncIndexes().catch(() => undefined)));
  return conn;
}
