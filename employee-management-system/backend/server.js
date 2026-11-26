require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", require("./routes/api"));
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/health", (req, res) => res.json({ status: "ok", database: require("mongoose").connection.readyState === 1 ? "connected" : "disconnected" }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ message: "A record with this value already exists." });
  if (err.name === "ValidationError") return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join(" ") });
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid record ID." });
  if (err.message?.includes("Only JPG")) return res.status(400).json({ message: err.message });
  if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "Image must be smaller than 3 MB." });
  res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong." : err.message || "Internal server error." });
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Employee Management System running at http://localhost:${PORT}`));
}).catch(err => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});
