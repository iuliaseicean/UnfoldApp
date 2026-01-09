// backend/src/routes/users.routes.js
const router = require("express").Router();
const { Op } = require("sequelize");
const auth = require("../middlewares/auth");
const User = require("../models/User");

/**
 * Helpers ca să nu crape dacă DB-ul are alte coloane (snake_case/camelCase)
 */
function hasAttr(name) {
  return !!User?.rawAttributes?.[name];
}

/**
 * Alege PK real (id / user_id)
 */
function getUserPkField() {
  if (hasAttr("id")) return "id";
  if (hasAttr("user_id")) return "user_id";
  return User.primaryKeyAttribute || "id";
}

/**
 * Normalizează id-ul userului din token (id / user_id)
 */
function getAuthUserId(req) {
  return req.user?.id ?? req.user?.user_id ?? null;
}

/**
 * Doar câmpurile SAFE din User (fără parolă, fără hash etc.)
 */
function getSafeUserAttributes() {
  const safe = [];

  // PK-uri posibile
  if (hasAttr("id")) safe.push("id");
  if (hasAttr("user_id")) safe.push("user_id");

  // Identitate
  if (hasAttr("username")) safe.push("username");
  if (hasAttr("name")) safe.push("name");
  if (hasAttr("email")) safe.push("email");

  // Profil
  if (hasAttr("bio")) safe.push("bio");
  if (hasAttr("avatar_url")) safe.push("avatar_url");

  // Date
  if (hasAttr("created_at")) safe.push("created_at");
  if (hasAttr("updated_at")) safe.push("updated_at");
  if (hasAttr("createdAt")) safe.push("createdAt");
  if (hasAttr("updatedAt")) safe.push("updatedAt");

  return safe.length ? safe : undefined;
}

/**
 * Câmpuri pe care căutăm (username/name/email)
 */
function getSearchFields() {
  const fields = [];
  if (hasAttr("username")) fields.push("username");
  if (hasAttr("name")) fields.push("name");
  if (hasAttr("email")) fields.push("email");
  return fields;
}

/**
 * Construiește WHERE pentru search (și exclude user-ul curent)
 */
function buildUserSearchWhere(q, excludeUserId) {
  const pk = getUserPkField();
  const fields = getSearchFields();
  if (!q || !fields.length) return null;

  const or = fields.map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));

  if (excludeUserId) {
    return {
      [Op.and]: [{ [Op.or]: or }, { [pk]: { [Op.ne]: excludeUserId } }],
    };
  }

  return { [Op.or]: or };
}

// ─────────────────────────────────────────────
// GET /users/me
// ─────────────────────────────────────────────
router.get("/me", auth, async (req, res, next) => {
  try {
    const pk = getUserPkField();
    const myId = getAuthUserId(req);
    if (!myId) return res.status(401).json({ error: "Unauthorized" });

    const me = await User.findOne({
      where: { [pk]: myId },
      attributes: getSafeUserAttributes(),
    });

    if (!me) return res.status(404).json({ error: "User not found" });
    return res.json(me);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// PATCH /users/me
// update username / name / bio / avatar_url / email (dacă există coloanele)
// ─────────────────────────────────────────────
router.patch("/me", auth, async (req, res, next) => {
  try {
    const pk = getUserPkField();
    const myId = getAuthUserId(req);
    if (!myId) return res.status(401).json({ error: "Unauthorized" });

    const me = await User.findOne({ where: { [pk]: myId } });
    if (!me) return res.status(404).json({ error: "User not found" });

    const { username, bio, email, name, avatar_url } = req.body || {};

    // username + unicitate
    if (typeof username === "string" && hasAttr("username")) {
      const u = username.trim();
      if (u.length < 2) return res.status(400).json({ error: "username too short" });

      const exists = await User.findOne({
        where: { username: u, [pk]: { [Op.ne]: me.get(pk) } },
      });
      if (exists) return res.status(409).json({ error: "Username already in use" });

      me.username = u;
    }

    // name
    if (typeof name === "string" && hasAttr("name")) {
      me.name = name.trim();
    }

    // bio
    if (typeof bio === "string" && hasAttr("bio")) {
      me.bio = bio.trim();
    }

    // avatar_url
    if (typeof avatar_url === "string" && hasAttr("avatar_url")) {
      me.avatar_url = avatar_url.trim();
    }

    // email + unicitate (opțional)
    if (typeof email === "string" && hasAttr("email")) {
      const em = email.trim().toLowerCase();
      if (!em.includes("@")) return res.status(400).json({ error: "invalid email" });

      const exists = await User.findOne({
        where: { email: em, [pk]: { [Op.ne]: me.get(pk) } },
      });
      if (exists) return res.status(409).json({ error: "Email already in use" });

      me.email = em;
    }

    await me.save();

    const safe = await User.findOne({
      where: { [pk]: myId },
      attributes: getSafeUserAttributes(),
    });

    return res.json(safe);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// GET /users/search?q=...   (recomandat pentru frontend)
// ─────────────────────────────────────────────
router.get("/search", auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);

    const myId = getAuthUserId(req);
    const where = buildUserSearchWhere(q, myId);
    if (!where) return res.json([]);

    const pk = getUserPkField();

    const list = await User.findAll({
      where,
      attributes: getSafeUserAttributes(),
      limit: 30,
      order: hasAttr("username") ? [["username", "ASC"]] : [[pk, "ASC"]],
    });

    res.json(list);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// GET /users?query=...  (compatibil cu varianta veche)
// ─────────────────────────────────────────────
router.get("/", auth, async (req, res, next) => {
  try {
    const q = String(req.query.query || "").trim();
    if (!q) return res.json([]);

    const myId = getAuthUserId(req);
    const where = buildUserSearchWhere(q, myId);
    if (!where) return res.json([]);

    const pk = getUserPkField();

    const list = await User.findAll({
      where,
      attributes: getSafeUserAttributes(),
      limit: 30,
      order: hasAttr("username") ? [["username", "ASC"]] : [[pk, "ASC"]],
    });

    res.json(list);
  } catch (e) {
    next(e);
  }
});

module.exports = router;