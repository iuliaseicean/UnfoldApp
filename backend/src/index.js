require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { connectDB, sequelize } = require("./config/db");

// modelele trebuie importate ca să înregistreze asocierile
const User = require("./models/User");
const Content = require("./models/Content");

// capsule models (require e suficient ca să înregistreze asocierile)
require("./models/Capsule");
require("./models/CapsuleContribution");
require("./models/CapsuleKey");
require("./models/CapsuleAccess");

const app = express();

// IMPORTANT pt ngrok / reverse proxy (x-forwarded-proto, etc.)
app.set("trust proxy", 1);

// ── Middleware de bază
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  })
);


// ✅ Servește fișierele încărcate (din backend/uploads)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Healthcheck
app.get("/", (_req, res) => res.send("✅ Unfold API (SQL Server) is running"));

// Rute
app.use("/auth", require("./routes/auth.routes"));
app.use("/content", require("./routes/content.routes"));
app.use("/capsules", require("./routes/capsules.routes"));

// ✅ Upload route (trebuie să existe backend/src/routes/upload.routes.js)
app.use("/upload", require("./routes/upload.routes"));

// Handler global erori (după rute)
app.use(require("./middlewares/error"));

// ── Bootstrap aplicație
(async () => {
  try {
    await connectDB();

    await sequelize.sync();
    console.log("📊 Tables synchronized");

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
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