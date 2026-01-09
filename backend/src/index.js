// backend/src/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { connectDB, sequelize } = require("./config/db");

// ─────────────────────────────────────────────
// Import modele (ca să înregistreze asocierile)
// ─────────────────────────────────────────────
require("./models/User");
require("./models/Content");

// capsule models
require("./models/Capsule");
require("./models/CapsuleContribution");
require("./models/CapsuleKey");
require("./models/CapsuleAccess");

// post models
require("./models/Post");
require("./models/PostLike");
require("./models/PostComment");

const app = express();

// IMPORTANT pentru ngrok / reverse proxy
app.set("trust proxy", 1);

// ─────────────────────────────────────────────
// Middleware de bază
// ─────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

// Helmet: permite încărcarea imaginilor / QR / uploads cross-origin
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(morgan("dev"));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ─────────────────────────────────────────────
// Static uploads
// index.js este în backend/src, folderul uploads e în backend/uploads
// URL: http://localhost:4000/uploads/<file>
// ─────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Healthcheck
app.get("/", (_req, res) => res.send("✅ Unfold API (SQL Server) is running"));

// ─────────────────────────────────────────────
// Rute
// ─────────────────────────────────────────────
app.use("/auth", require("./routes/auth.routes"));
app.use("/content", require("./routes/content.routes"));
app.use("/capsules", require("./routes/capsules.routes"));
app.use("/upload", require("./routes/upload.routes"));
app.use("/users", require("./routes/users.routes"));

// Handler global de erori (după rute)
app.use(require("./middlewares/error"));

// ─────────────────────────────────────────────
// Bootstrap aplicație
// ─────────────────────────────────────────────
(async () => {
  try {
    await connectDB();

    // IMPORTANT:
    // Fără acces la DB, nu te baza pe sync ca să creezi tabele noi.
    // Rulează sync doar dacă DB_SYNC=true.
    if (String(process.env.DB_SYNC || "").toLowerCase() === "true") {
      await sequelize.sync({ alter: false });
      console.log("📊 Tables synchronized (DB_SYNC=true)");
    } else {
      console.log("ℹ Skipping sequelize.sync() (DB_SYNC is not true)");
    }

    const PORT = Number(process.env.PORT || 4000);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);

      if (process.env.APP_URL) {
        console.log(`🌍 APP_URL = ${process.env.APP_URL}`);
      } else {
        console.log("ℹ Setează APP_URL în .env (pt QR / ngrok), ex: https://xxxx.ngrok-free.app");
      }
    });
  } catch (err) {
    console.error("❌ Fatal startup error:", err);
    process.exit(1);
  }
})();

// Oprire grațioasă
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  try {
    await sequelize.close();
  } finally {
    process.exit(0);
  }
});