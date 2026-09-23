import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["citizen", "staff", "admin"], required: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  department: String,
  workTypes: { type: [String], default: [] },
  coins: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

const updateSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  note: { type: String, required: true, trim: true },
  percent: { type: Number, required: true, min: 0, max: 100 },
  photoUrl: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

const ratingSchema = new Schema({
  citizen: { type: Schema.Types.ObjectId, ref: "User", required: true },
  score: { type: Number, required: true, min: 1, max: 5 },
  feedback: { type: String, trim: true, default: "" },
}, { timestamps: { createdAt: true, updatedAt: false } });

const reportSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  status: { type: String, enum: ["submitted", "assigned", "in-progress", "completed"], default: "submitted" },
  priority: { type: String, enum: ["low", "medium", "high", "critical"], default: null },
  citizen: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  photoUrl: String,
  completionPhotoUrl: String,
  assignedAt: Date,
  completedAt: Date,
  updates: { type: [updateSchema], default: [] },
  rating: { type: ratingSchema, default: null },
}, { timestamps: true });
reportSchema.index({ citizen: 1, createdAt: -1 });
reportSchema.index({ assignedTo: 1, createdAt: -1 });

const payoutSchema = new Schema({
  staff: { type: Schema.Types.ObjectId, ref: "User", required: true },
  coins: { type: Number, required: true, min: 1 },
  amount: { type: Number, required: true, min: 0.01 },
}, { timestamps: true });

export const User = model("User", userSchema);
export const Report = model("Report", reportSchema);
export const Payout = model("Payout", payoutSchema);
