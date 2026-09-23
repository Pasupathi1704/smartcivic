import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDatabase } from "./db.js";
import { User } from "./models.js";

const accounts = [
  ["citizen_raj", "citizen123", "citizen", "Raj Menon", null, []],
  ["citizen_maya", "citizen123", "citizen", "Maya Iyer", null, []],
  ["admin", "admin123", "admin", "S. Fernandes", null, []],
  ["staff_amara", "staff123", "staff", "Amara Okoye", "Sanitation & Waste", ["Waste collection", "Street cleaning"]],
  ["staff_kofi", "staff123", "staff", "Kofi Boateng", "Roads & Infrastructure", ["Pothole repair", "Streetlight maintenance"]],
  ["staff_priya", "staff123", "staff", "Priya Nair", "Water Supply", ["Leak repair", "Water pressure"]],
];

await connectDatabase();
for (const [username, password, role, name, department, workTypes] of accounts) {
  const passwordHash = await bcrypt.hash(password, 12);
  await User.updateOne(
    { username },
    { $setOnInsert: { username, passwordHash, role, name, department, workTypes } },
    { upsert: true },
  );
}
console.log("Demo users seeded.");
await mongoose.disconnect();

