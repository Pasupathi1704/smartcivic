import mongoose from "mongoose";
import { connectDatabase } from "./db.js";
import { User, Report, Payout } from "./models.js";

await connectDatabase();
await Promise.all([User.init(), Report.init(), Payout.init()]);
console.log("MongoDB indexes initialized.");
await mongoose.disconnect();
