const router = require("express").Router();
const { Op } = require("sequelize");
const auth = require("../middlewares/auth");
const User = require("../models/User");

// GET /users/me
router.get("/me", auth, async (req, res, next) => {
  try {
    const me = await User.findByPk(req.user.id, {
      attributes: ["id", "username", "email", "bio", "createdAt", "updatedAt"],
    });
    return res.json(me);
  } catch (e) {
    next(e);
  }
});

// PATCH /users/me  (update username/bio; optional email)
router.patch("/me", auth, async (req, res, next) => {
  try {
    const { username, bio, email } = req.body || {};

    const me = await User.findByPk(req.user.id);
    if (!me) return res.status(404).json({ error: "User not found" });

    if (typeof username === "string") {
      const u = username.trim();
      if (u.length < 2) return res.status(400).json({ error: "username too short" });
      me.username = u;
    }

    if (typeof bio === "string") {
      me.bio = bio.trim();
    }

    // optional: allow email update (cu verificare unicitate)
    if (typeof email === "string") {
      const em = email.trim().toLowerCase();
      if (!em.includes("@")) return res.status(400).json({ error: "invalid email" });

      const exists = await User.findOne({
        where: { email: em, id: { [Op.ne]: me.id } },
      });
      if (exists) return res.status(409).json({ error: "Email already in use" });

      me.email = em;
    }

    await me.save();

    const safe = await User.findByPk(me.id, {
      attributes: ["id", "username", "email", "bio", "createdAt", "updatedAt"],
    });

    return res.json(safe);
  } catch (e) {
    next(e);
  }
});

// GET /users?query=...  (search username + email)
router.get("/", auth, async (req, res, next) => {
  try {
    const q = String(req.query.query || "").trim();
    if (!q) return res.json([]);

    const list = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ["id", "username", "email", "bio"],
      order: [["username", "ASC"]],
      limit: 30,
    });

    res.json(list);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
