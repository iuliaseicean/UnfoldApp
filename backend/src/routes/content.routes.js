const router = require("express").Router();
const auth = require("../middlewares/auth");

const Post = require("../models/Post");
const User = require("../models/User");

/**
 * Alege automat coloana corectă de sortare:
 * - created_at (snake_case) sau createdAt (camelCase) sau PK
 */
function getOrderField() {
  const attrs = Post?.rawAttributes || {};
  if (attrs.created_at) return "created_at";
  if (attrs.createdAt) return "createdAt";
  // fallback: PK
  return Post.primaryKeyAttribute || "id";
}

/**
 * Alege automat cheia primară a lui User pentru join (id / user_id)
 */
function getUserPk() {
  const u = User?.rawAttributes || {};
  if (u.id) return "id";
  if (u.user_id) return "user_id";
  return User.primaryKeyAttribute || "id";
}

/**
 * Returnează doar câmpurile SAFE din User (fără parolă)
 * (nu punem name/avatar dacă nu suntem siguri că există)
 */
function getSafeUserAttributes() {
  const u = User?.rawAttributes || {};
  const safe = [];
  if (u.id) safe.push("id");
  if (u.user_id) safe.push("user_id");
  if (u.username) safe.push("username");
  if (u.email) safe.push("email");
  if (u.name) safe.push("name");
  if (u.avatar_url) safe.push("avatar_url");
  return safe.length ? safe : undefined; // dacă nu știm, lăsăm Sequelize default
}

// GET /content/posts  -> feed
router.get("/posts", async (req, res, next) => {
  try {
    const orderField = getOrderField();
    const safeUserAttrs = getSafeUserAttributes();

    const list = await Post.findAll({
      include: [
        {
          model: User,
          attributes: safeUserAttrs, // doar ce există + safe
          required: false,
        },
      ],
      order: [[orderField, "DESC"]],
      limit: 100,
    });

    res.json(list);
  } catch (e) {
    next(e);
  }
});

// GET /content/posts/:id
router.get("/posts/:id", async (req, res, next) => {
  try {
    const safeUserAttrs = getSafeUserAttributes();

    const item = await Post.findByPk(req.params.id, {
      include: [
        {
          model: User,
          attributes: safeUserAttrs,
          required: false,
        },
      ],
    });

    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

// POST /content/posts  -> creare postare
router.post("/posts", auth, async (req, res, next) => {
  try {
    const { content_text = "", media_url = null, visibility = "public" } = req.body || {};

    if (!String(content_text || "").trim() && !media_url) {
      return res.status(400).json({ message: "Post must have text or media" });
    }

    // IMPORTANT: aici cheia userului poate fi id sau user_id, depinde de auth middleware.
    // Dacă în auth middleware pui req.user.id, folosim asta.
    // Dacă ai req.user.user_id, schimbă aici.
    const userPk = getUserPk();
    const userId = req.user?.id ?? req.user?.user_id;

    const created = await Post.create({
      // adaptează numele foreign key-ului în Post (user_id sau authorId etc.)
      user_id: userId,
      content_text: String(content_text || "").trim(),
      media_url,
      visibility,
    });

    const safeUserAttrs = getSafeUserAttributes();

    const full = await Post.findByPk(created[Post.primaryKeyAttribute || "id"], {
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
    });

    res.status(201).json(full || created);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
