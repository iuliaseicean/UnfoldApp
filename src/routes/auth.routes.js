const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middlewares/auth");

// REGISTER
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email & password required" });

    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ error: "Email already in use" });

    const password_hash = await bcrypt.hash(password, 10);
    const u = await User.create({ name: name || email.split("@")[0], email, password_hash });
    res.status(201).json({ user_id: u.user_id, name: u.name, email: u.email });
  } catch (e) { next(e); }
});

// LOGIN
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const u = await User.findOne({ where: { email } });
    if (!u) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: u.user_id, email: u.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { user_id: u.user_id, name: u.name, email: u.email } });
  } catch (e) { next(e); }
});

// ME
router.get("/me", auth, async (req, res, next) => {
  try {
    const u = await User.findByPk(req.user.id, { attributes: ["user_id","name","email","avatar_url","bio","interests","created_at"] });
    res.json(u);
  } catch (e) { next(e); }
});

module.exports = router;
