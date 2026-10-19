import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Reuse the connection across hot reloads in dev and across invocations on
// a warm serverless instance (Vercel), instead of opening a new pool per request.
const globalForMongoose = globalThis as unknown as { mongooseCache?: MongooseCache };
const cache: MongooseCache = (globalForMongoose.mongooseCache ??= { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to .env or .env.local (see .env.example).");
  }
  if (cache.conn) return cache.conn;

  cache.promise ??= mongoose.connect(MONGODB_URI, { bufferCommands: false });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
