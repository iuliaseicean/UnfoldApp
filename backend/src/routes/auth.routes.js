// backend/src/routes/auth.routes.js
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const auth = require("../middlewares/auth");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normStr(v) {
  return String(v || "").trim();
}

function getAuthUserId(req) {
  return req.user?.id ?? req.user?.user_id ?? null;
}

/**
 * Răspuns user safe (nu trimitem password/resetToken etc.)
 * Adaugă ce ai în model: bio, avatar_url, is_private dacă există.
 */
function pickSafeUser(user) {
  if (!user) return null;

  const json = typeof user.toJSON === "function" ? user.toJSON() : user;

  const out = {
    id: json.id ?? json.user_id,
    username: json.username,
    email: json.email,
  };

  // optional fields (dacă există în model)
  if (json.bio !== undefined) out.bio = json.bio;
  if (json.avatar_url !== undefined) out.avatar_url = json.avatar_url;
  if (json.is_private !== undefined) out.is_private = json.is_private;

  if (json.createdAt !== undefined) out.createdAt = json.createdAt;
  if (json.updatedAt !== undefined) out.updatedAt = json.updatedAt;

  return out;
}

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────
router.post("/register", async (req, res, next) => {
  try {
    const username = normStr(req.body?.username);
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!username || !email || !password) {
      return res.status(400).json({
        error: "username, email și password sunt obligatorii",
      });
    }

    if (username.length < 2) {
      return res.status(400).json({ error: "Username must be at least 2 characters long!" });
    }

    if (!email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long!",
      });
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    return res.status(201).json(pickSafeUser(user));
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "email și password necesare" });
    }

    // IMPORTANT: dacă JWT_SECRET lipsește -> altfel ai 500 “misterios”
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: "Server misconfigured: JWT_SECRET missing in .env",
      });
    }

    const user = await User.findOne({ where: { email } });

    // răspuns generic
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // dacă în DB password e null / gol, evităm crash
    if (!user.password) {
      return res.status(500).json({
        error: "User record is corrupted (missing password hash). Create a new account or fix DB record.",
      });
    }

    // bcrypt compare safe
    const match = await bcrypt.compare(password, String(user.password));
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: pickSafeUser(user),
    });
  } catch (e) {
    // ca să vezi exact cauza în terminal
    console.error("LOGIN ERROR:", e);
    next(e);
  }
});

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────
router.post("/forgot-password", async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ error: "email necesar" });
    }

    const user = await User.findOne({ where: { email } });

    // răspuns generic — nu divulgăm existența user-ului
    if (!user) {
      return res.json({
        message: "If this email exists, reset instructions have been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    // IMPORTANT: în model ai DATE -> salvăm Date, nu number
    const expireDate = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    user.resetToken = resetToken;
    user.resetTokenExpire = expireDate;
    await user.save();

    console.log("🔐 Reset token generated:", resetToken);

    return res.json({
      message: "If this email exists, reset instructions have been sent.",
      resetToken, // pentru test — scoate în production
    });
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────
router.post("/reset-password", async (req, res, next) => {
  try {
    const token = normStr(req.body?.token);
    const newPassword = String(req.body?.newPassword || "");

    if (!token || !newPassword) {
      return res.status(400).json({ error: "token and newPassword are mandatory" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long!",
      });
    }

    const user = await User.findOne({ where: { resetToken: token } });
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // resetTokenExpire este DATE (Date object)
    if (!user.resetTokenExpire || new Date(user.resetTokenExpire).getTime() < Date.now()) {
      return res.status(400).json({ error: "Token expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpire = null;

    await user.save();

    return res.json({ message: "Password has been reset successfully" });
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// ME (protected)
// ─────────────────────────────────────────────
router.get("/me", auth, async (req, res, next) => {
  try {
    const myId = getAuthUserId(req);
    if (!myId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findByPk(myId, {
      // nu includem password/reset token etc.
      attributes: [
        "id",
        "username",
        "email",
        "bio",
        // dacă le ai în model, le va include; dacă nu, nu strică (dar poate da error dacă nu există)
        // dacă vrei 100% safe, scoate-le dacă nu le ai.
        "avatar_url",
        "is_private",
        "createdAt",
        "updatedAt",
      ].filter(Boolean),
    });

    return res.json(user ? pickSafeUser(user) : null);
  } catch (e) {
    next(e);
  }
});

module.exports = router;