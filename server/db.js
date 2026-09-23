import mongoose from "mongoose";
import "dotenv/config";

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required. Copy .env.example to .env and set it.");
  await mongoose.connect(process.env.MONGODB_URI);
  return mongoose.connection;
}
