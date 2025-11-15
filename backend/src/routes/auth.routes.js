const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middlewares/auth");

// REGISTER
router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "username, email și password sunt obligatorii" });
    }

    // verificăm dacă email-ul e deja folosit
    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return res.status(409).json({ error: "Email already in use" });
    }

    // hash parolă
    const hashedPassword = await bcrypt.hash(password, 10);

    // creare utilizator
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

// LOGIN
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

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "email necesar" });
    }

    const user = await User.findOne({ where: { email } });

    if (user) {
      console.log("📧 Forgot password requested for:", user.email);
      // Aici poți implementa logica reală:
      //  - generezi un token
      //  - îl salvezi în DB / tabel de reset-uri
      //  - trimiți email cu link de reset
    }

    // răspuns generic, ca să nu dezvăluim dacă emailul există sau nu
    return res.json({
      message: "If this email exists, we sent you reset instructions.",
    });
  } catch (e) {
    next(e);
  }
});

// ME
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
