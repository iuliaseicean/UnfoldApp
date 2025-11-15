const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middlewares/auth");

// REGISTER
router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password)
      return res.status(400).json({ error: "username, email și password sunt obligatorii" });

    // verificam dacă email-ul e deja folosit
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ error: "Email already in use" });

    // hash parola
    const hashedPassword = await bcrypt.hash(password, 10);

    // creare utilizator
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
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

    if (!email || !password)
      return res.status(400).json({ error: "email și password necesare" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
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

// ME
router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "username", "email", "bio", "createdAt", "updatedAt"],
    });

    res.json(user);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
