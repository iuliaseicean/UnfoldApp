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

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ── Middleware de bază
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // fallback dacă nu e setat în .env
  })
);
app.use(helmet());
app.use(express.json());
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

// Handler global erori (trebuie să fie după rute)
app.use(require("./middlewares/error"));

// ── Bootstrap aplicație
(async () => {
  try {
    await connectDB();

    // ⚠️ Dacă trebuie să recreezi tabelele de la zero (doar în dev!):
    // await sequelize.sync({ force: true });

    // Normal: sincronizare fără alter/force, ca să nu mai dea eroarea cu UNIQUE
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
