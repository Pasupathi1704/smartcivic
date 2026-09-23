import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import mongoose from "mongoose";
import { connectDatabase } from "./db.js";
import { User, Report, Payout } from "./models.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 5000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is required. Copy .env.example to .env and set it.");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "civic-register",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"]
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});
const app = express();

// Gzip compress all HTTP responses
app.use(compression());

/* The API is secured by JWT, so we can safely allow all origins.
   This avoids brittle env-var-based origin matching when the frontend
   and backend are co-hosted on the same Render URL. */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
// Local uploads no longer served
// Cache static assets (CSS, JS, images) for 1 day
app.use(express.static(root, { index: "index.html", maxAge: "1d" }));

const tokenFor = user => jwt.sign({ sub: user.id, role: user.role, username: user.username }, jwtSecret, { expiresIn: "8h" });
const publicUser = user => ({ id: String(user._id), username: user.username, role: user.role, name: user.name, department: user.department, workTypes: user.workTypes, coins: user.coins });
function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required." });
  try { req.user = jwt.verify(token, jwtSecret); next(); }
  catch { res.status(401).json({ error: "Your session has expired. Sign in again." }); }
}
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: "You do not have permission for this action." });
async function reportById(id) {
  return Report.findById(id).populate("citizen assignedTo updates.author rating.citizen").lean();
}
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: "Too many requests from this IP, please try again after 15 minutes." } });

app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.body?.username }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(req.body?.password || "", user.passwordHash))) return res.status(401).json({ error: "Invalid username or password." });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});
app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  try {
    const { name, username, password } = req.body || {};
    const cleanUsername = String(username || "").trim().toLowerCase();
    if (!String(name || "").trim() || !/^[a-z0-9_]{3,}$/.test(cleanUsername) || String(password || "").length < 6) {
      return res.status(400).json({ error: "Enter your name, a username with 3+ letters/numbers/underscores, and a password with 6+ characters." });
    }
    const user = await User.create({
      name: name.trim(),
      username: cleanUsername,
      passwordHash: await bcrypt.hash(password, 12),
      role: "citizen",
    });
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: "That username is already in use." });
    next(error);
  }
});
app.get("/api/auth/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(401).json({ error: "Account no longer exists." });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});
app.patch("/api/auth/me", authenticate, async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "A display name is required." });
    const update = { name: name.trim(), email: email?.trim() || undefined, phone: phone?.trim() || undefined };
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
      update.passwordHash = await bcrypt.hash(password, 12);
    }
    const user = await User.findByIdAndUpdate(req.user.sub, update, { new: true });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});
app.get("/api/users", authenticate, allow("admin"), async (_req, res, next) => {
  try { res.json({ users: (await User.find().sort({ role: 1, name: 1 })).map(publicUser) }); }
  catch (error) { next(error); }
});
app.post("/api/users", authenticate, allow("admin"), async (req, res, next) => {
  try {
    const { username, password, name, department, workTypes = [] } = req.body || {};
    if (!username?.match(/^[a-z0-9_]{3,}$/) || !name?.trim() || !password || password.length < 6) return res.status(400).json({ error: "Provide a name, valid username, and password of at least 6 characters." });
    const user = await User.create({ username, passwordHash: await bcrypt.hash(password, 12), role: "staff", name, department, workTypes });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: "That username is already in use." });
    next(error);
  }
});
app.get("/api/reports", authenticate, async (req, res, next) => {
  try {
    const filter = req.user.role === "admin" ? {} : req.user.role === "staff" ? { assignedTo: req.user.sub } : { citizen: req.user.sub };
    const reports = await Report.find(filter).sort({ createdAt: -1 }).populate("citizen assignedTo updates.author rating.citizen").lean();
    res.json({ reports });
  } catch (error) { next(error); }
});
app.post("/api/reports", authenticate, allow("citizen"), async (req, res, next) => {
  try {
    const { title, description, category, photoUrl } = req.body || {};
    if (![title, description, category].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Title, description, and category are required." });
    const report = await Report.create({ title, description, category, citizen: req.user.sub, photoUrl: photoUrl || undefined });
    res.status(201).json({ report: await reportById(report.id) });
  } catch (error) { next(error); }
});
app.patch("/api/reports/:id/assignment", authenticate, allow("admin"), async (req, res, next) => {
  try {
    const { staffId, priority } = req.body || {};
    if (!["low", "medium", "high", "critical"].includes(priority)) return res.status(400).json({ error: "A valid priority is required." });
    const staff = await User.findOne({ _id: staffId, role: "staff" });
    if (!staff) return res.status(400).json({ error: "Choose a valid staff member." });
    const report = await Report.findByIdAndUpdate(req.params.id, { assignedTo: staff.id, priority, status: "assigned", assignedAt: new Date() }, { new: true });
    if (!report) return res.status(404).json({ error: "Report not found." });
    res.json({ report: await reportById(report.id) });
  } catch (error) { next(error); }
});
app.post("/api/reports/:id/updates", authenticate, allow("staff"), async (req, res, next) => {
  try {
    const { note, percent, photoUrl } = req.body || {};
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found." });
    if (String(report.assignedTo) !== req.user.sub) return res.status(403).json({ error: "This report is not assigned to you." });
    if (!note?.trim() || !Number.isInteger(percent) || percent < 0 || percent > 100) return res.status(400).json({ error: "A note and a percentage from 0 to 100 are required." });
    report.updates.push({ author: req.user.sub, note, percent, photoUrl: photoUrl || undefined });
    if (report.status !== "completed") report.status = "in-progress";
    await report.save();
    res.status(201).json({ report: await reportById(report.id) });
  } catch (error) { next(error); }
});
app.post("/api/reports/:id/complete", authenticate, allow("staff"), async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found." });
    if (String(report.assignedTo) !== req.user.sub) return res.status(403).json({ error: "This report is not assigned to you." });
    report.status = "completed"; report.completedAt = new Date(); report.completionPhotoUrl = req.body?.photoUrl || undefined;
    await report.save();
    res.json({ report: await reportById(report.id) });
  } catch (error) { next(error); }
});
app.post("/api/reports/:id/rating", authenticate, allow("citizen"), async (req, res, next) => {
  try {
    const { score, feedback = "" } = req.body || {};
    const report = await Report.findById(req.params.id);
    if (!report || String(report.citizen) !== req.user.sub) return res.status(404).json({ error: "Report not found." });
    if (report.status !== "completed" || report.rating || !Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: "This completed report cannot be rated." });
    const rated = await Report.findOneAndUpdate(
      { _id: report.id, rating: null },
      { $set: { rating: { citizen: req.user.sub, score, feedback } } },
      { new: true },
    );
    if (!rated) return res.status(409).json({ error: "This report has already been rated." });
    await User.findByIdAndUpdate(report.assignedTo, { $inc: { coins: score * 10 } });
    res.status(201).json({ report: await reportById(rated.id) });
  } catch (error) { next(error); }
});
app.post("/api/payouts", authenticate, allow("admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body?.staffId)) return res.status(400).json({ error: "Invalid staff member ID format." });
    const staff = await User.findOneAndUpdate({ _id: req.body?.staffId, role: "staff", coins: { $gt: 0 } }, { $set: { coins: 0 } }, { new: false });
    if (!staff) return res.status(400).json({ error: "This staff member has no coins to convert." });
    const payout = await Payout.create({ staff: staff.id, coins: staff.coins, amount: staff.coins / 10 });
    res.status(201).json({ payout });
  } catch (error) { next(error); }
});
app.post("/api/uploads", authenticate, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Upload an image smaller than 5 MB." });
  // req.file.path contains the secure Cloudinary URL
  res.status(201).json({ url: req.file.path });
});
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "Images must be 5 MB or smaller." });
  res.status(error.status || 500).json({ error: error.status ? error.message : "Unexpected server error." });
});
await connectDatabase();
app.listen(port, () => console.log(`VETRI Namma Kural API listening at http://localhost:${port}`));
