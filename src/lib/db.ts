import mongoose from "mongoose";
import { env } from "./env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { _mongoose?: MongooseCache };
const cache: MongooseCache = globalForMongoose._mongoose ?? { conn: null, promise: null };
if (!globalForMongoose._mongoose) globalForMongoose._mongoose = cache;

export async function connectDB(): Promise<typeof mongoose> {
  // Reuse only a live connection (1 = connected). A dropped one is rebuilt.
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (cache.conn && mongoose.connection.readyState !== 1) {
    cache.conn = null;
    cache.promise = null;
  }

  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || "exam_portal",
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      bufferCommands: false, // fail fast instead of hanging 10s
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