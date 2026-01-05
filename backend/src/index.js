require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { connectDB, sequelize } = require("./config/db");

// Import modele ca să înregistreze asocierile
require("./models/User");
require("./models/Content");
require("./models/Capsule");
require("./models/CapsuleContribution");
require("./models/CapsuleKey");
require("./models/CapsuleAccess");
require("./models/PostLike");
require("./models/PostComment");

const app = express();

// IMPORTANT pt ngrok / reverse proxy
app.set("trust proxy", 1);

// ── Middleware de bază
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// (dacă nu folosești încă routes astea, le poți comenta)
// app.use("/users", require("./routes/users.routes"));
// app.use("/feed", require("./routes/feed.routes"));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

app.use(helmet());
app.use(morgan("dev"));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ✅ STATIC uploads
// index.js este în backend/src, iar folderul este backend/uploads
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Healthcheck
app.get("/", (_req, res) => res.send("✅ Unfold API (SQL Server) is running"));

// Rute
app.use("/auth", require("./routes/auth.routes"));
app.use("/content", require("./routes/content.routes"));
app.use("/capsules", require("./routes/capsules.routes"));
app.use("/upload", require("./routes/upload.routes"));

// Handler global erori (după rute)
app.use(require("./middlewares/error"));

// ── Bootstrap aplicație
(async () => {
  try {
    await connectDB();

    if (String(process.env.DB_SYNC || "").toLowerCase() === "true") {
      await sequelize.sync();
      console.log("📊 Tables synchronized (DB_SYNC=true)");
    } else {
      console.log("ℹ Skipping sequelize.sync() (DB_SYNC is not true)");
    }

    const PORT = process.env.PORT || 4000;

    // ✅ ascultă pe toate interfețele (telefonul poate accesa via IP)
    app.listen(PORT, "0.0.0.0", () => {
      const appUrl = process.env.APP_URL || `http://<YOUR_LAN_IP>:${PORT}`;
      console.log(`🚀 Server listening on ${appUrl}`);
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
