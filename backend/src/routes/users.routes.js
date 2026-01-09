// backend/src/routes/users.routes.js
const router = require("express").Router();
const { Op } = require("sequelize");
const auth = require("../middlewares/auth");
const User = require("../models/User");

// OPTIONAL (dar recomandat pentru profil)
let Post = null;
try {
  Post = require("../models/Post");
} catch {
  Post = null;
}

/**
 * Helpers: compatibilitate DB (snake_case/camelCase)
 */
function hasAttr(model, name) {
  return !!model?.rawAttributes?.[name];
}

/**
 * id numeric safe
 */
function toId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Alege PK real (id / user_id)
 */
function getUserPkField() {
  if (hasAttr(User, "id")) return "id";
  if (hasAttr(User, "user_id")) return "user_id";
  return User.primaryKeyAttribute || "id";
}

/**
 * Normalizează id-ul userului din token (id / user_id)
 */
function getAuthUserId(req) {
  return req.user?.id ?? req.user?.user_id ?? null;
}

/**
 * Doar câmpurile SAFE din User (fără parolă/hash etc.)
 */
function getSafeUserAttributes() {
  const safe = [];

  // PK-uri posibile
  if (hasAttr(User, "id")) safe.push("id");
  if (hasAttr(User, "user_id")) safe.push("user_id");

  // Identitate
  if (hasAttr(User, "username")) safe.push("username");
  if (hasAttr(User, "name")) safe.push("name");
  if (hasAttr(User, "email")) safe.push("email");

  // Profil
  if (hasAttr(User, "bio")) safe.push("bio");
  if (hasAttr(User, "avatar_url")) safe.push("avatar_url");

  // Date
  if (hasAttr(User, "created_at")) safe.push("created_at");
  if (hasAttr(User, "updated_at")) safe.push("updated_at");
  if (hasAttr(User, "createdAt")) safe.push("createdAt");
  if (hasAttr(User, "updatedAt")) safe.push("updatedAt");

  return safe.length ? safe : undefined;
}

/**
 * Câmpuri pe care căutăm (username/name/email)
 */
function getSearchFields() {
  const fields = [];
  if (hasAttr(User, "username")) fields.push("username");
  if (hasAttr(User, "name")) fields.push("name");
  if (hasAttr(User, "email")) fields.push("email");
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
    return { [Op.and]: [{ [Op.or]: or }, { [pk]: { [Op.ne]: excludeUserId } }] };
  }

  return { [Op.or]: or };
}

/**
 * Sortare stabilă: username sau pk
 */
function getDefaultUserOrder() {
  const pk = getUserPkField();
  if (hasAttr(User, "username")) return [["username", "ASC"]];
  return [[pk, "ASC"]];
}

/**
 * Sortare stabilă pentru Post: created_at / createdAt / id
 */
function getPostOrderField() {
  if (!Post) return "id";
  if (hasAttr(Post, "created_at")) return "created_at";
  if (hasAttr(Post, "createdAt")) return "createdAt";
  return Post.primaryKeyAttribute || "id";
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
    if (typeof username === "string" && hasAttr(User, "username")) {
      const u = username.trim();
      if (u.length < 2) return res.status(400).json({ error: "username too short" });

      const exists = await User.findOne({
        where: { username: u, [pk]: { [Op.ne]: me.get(pk) } },
      });
      if (exists) return res.status(409).json({ error: "Username already in use" });

      me.username = u;
    }

    // name
    if (typeof name === "string" && hasAttr(User, "name")) {
      me.name = name.trim();
    }

    // bio
    if (typeof bio === "string" && hasAttr(User, "bio")) {
      me.bio = bio.trim();
    }

    // avatar_url
    if (typeof avatar_url === "string" && hasAttr(User, "avatar_url")) {
      me.avatar_url = avatar_url.trim();
    }

    // email + unicitate (opțional)
    if (typeof email === "string" && hasAttr(User, "email")) {
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
// GET /users/search?q=...   (IMPORTANT: înainte de "/:id")
// ─────────────────────────────────────────────
router.get("/search", auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);

    const myId = getAuthUserId(req);
    const where = buildUserSearchWhere(q, myId);
    if (!where) return res.json([]);

    const list = await User.findAll({
      where,
      attributes: getSafeUserAttributes(),
      limit: 30,
      order: getDefaultUserOrder(),
    });

    res.json(list);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// ✅ GET /users/:id/posts  (IMPORTANT: înainte de "/:id")
// ─────────────────────────────────────────────
router.get("/:id/posts", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid user id" });

    if (!Post) return res.json([]); // dacă nu aveți modelul Post încă

    const pk = getUserPkField();

    // verifică existența user-ului
    const user = await User.findOne({ where: { [pk]: id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // postări ale user-ului (presupunem user_id)
    // + include User safe dacă există asocierea Post.belongsTo(User)
    const includeUser =
      typeof Post?.associations?.User !== "undefined"
        ? [{ model: User, attributes: getSafeUserAttributes(), required: false }]
        : [];

    const list = await Post.findAll({
      where: { user_id: id },
      include: includeUser,
      order: [[getPostOrderField(), "DESC"]],
      limit: 50,
    });

    res.json(list);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// ✅ GET /users/:id  (profil user)
// ─────────────────────────────────────────────
router.get("/:id", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid user id" });

    const pk = getUserPkField();

    const user = await User.findOne({
      where: { [pk]: id },
      attributes: getSafeUserAttributes(),
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// GET /users?query=...  (compatibil vechi)
// ─────────────────────────────────────────────
router.get("/", auth, async (req, res, next) => {
  try {
    const q = String(req.query.query || "").trim();
    if (!q) return res.json([]);

    const myId = getAuthUserId(req);
    const where = buildUserSearchWhere(q, myId);
    if (!where) return res.json([]);

    const list = await User.findAll({
      where,
      attributes: getSafeUserAttributes(),
      limit: 30,
      order: getDefaultUserOrder(),
    });

    res.json(list);
  } catch (e) {
    next(e);
  }
});

module.exports = router;