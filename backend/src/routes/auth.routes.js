const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const auth = require("../middlewares/auth");

// ==============================
// REGISTER
// ==============================
router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "username, email și password sunt obligatorii" });
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

    return res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  } catch (e) {
    next(e);
  }
});

// ==============================
// LOGIN
// ==============================
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email și password necesare" });
    }



    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
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
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ==============================
// FORGOT PASSWORD (nou, complet)
// ==============================
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "email necesar" });
    }

    const user = await User.findOne({ where: { email } });

    // Răspuns generic — nu divulgăm existența user-ului
    if (!user) {
      return res.json({
        message: "If this email exists, reset instructions have been sent.",
      });
    }

    // Generăm token random
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expireDate = Date.now() + 15 * 60 * 1000; // 15 min

    user.resetToken = resetToken;
    user.resetTokenExpire = expireDate;
    await user.save();

    console.log("🔐 Reset token generated:", resetToken);

    return res.json({
      message: "If this email exists, reset instructions have been sent.",
      resetToken, // pentru testare — îl scoatem după ce adăugăm email service
    });
  } catch (e) {
    next(e);
  }
});


// ==============================
// RESET PASSWORD
// ==============================
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({
        error: "token and newPassword are mandatory",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long!",
      });
    }


    // căutăm userul cu acest token
    const user = await User.findOne({ where: { resetToken: token } });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // verificăm expirarea
    if (user.resetTokenExpire < Date.now()) {
      return res.status(400).json({ error: "Token expired" });
    }

    // hash parola nouă
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // salvăm parola nouă + resetăm token-ul
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpire = null;

    await user.save();

    return res.json({ message: "Password has been reset successfully" });
  } catch (e) {
    next(e);
  }
});


// ==============================
// ME (protected)
// ==============================
router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "username", "email", "bio", "createdAt", "updatedAt"],
    });

    return res.json(user);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
