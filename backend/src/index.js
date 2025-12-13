require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
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
app.set("trust proxy", 1);

// ── Middleware de bază
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // fallback dacă nu e setat în .env
  })
);

app.use(helmet());
app.use(morgan("dev"));

app.use(
  rateLimit({
    windowMs: 60_000, // 1 minut
    max: 100, // max 100 request-uri/minut/ip
  })
);

// Healthcheck
app.get("/", (_req, res) => res.send("✅ Unfold API (SQL Server) is running"));

// Rute
app.use("/auth", require("./routes/auth.routes"));
app.use("/content", require("./routes/content.routes"));
app.use("/capsules", require("./routes/capsules.routes"));


// Handler global erori (trebuie să fie după rute)
app.use(require("./middlewares/error"));

// ── Bootstrap aplicație
(async () => {
  try {
    await connectDB();

    // ⚠️ DEV: sincronizează schema DB cu modelele (adaugă coloane lipsă etc.)
    // După ce totul e stabil, poți reveni la: await sequelize.sync();
    await sequelize.sync();
    console.log("📊 Tables synchronized");


    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
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
