const router = require("express").Router();
const auth = require("../middlewares/auth");

const Post = require("../models/Post");
const User = require("../models/User");
const PostLike = require("../models/PostLike");
const PostComment = require("../models/PostComment");

const { sequelize } = require("../config/db");

/**
 * Alege automat coloana corectă de sortare:
 * - created_at (snake_case) sau createdAt (camelCase) sau PK
 */
function getOrderField() {
  const attrs = Post?.rawAttributes || {};
  if (attrs.created_at) return "created_at";
  if (attrs.createdAt) return "createdAt";
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
  return safe.length ? safe : undefined;
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
          attributes: safeUserAttrs,
          required: false,
        },
      ],
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) FROM post_like pl
              WHERE pl.post_id = Post.id
            )`),
            "likeCount",
          ],
          [
            sequelize.literal(`(
              SELECT COUNT(*) FROM post_comment pc
              WHERE pc.post_id = Post.id
            )`),
            "commentCount",
          ],
        ],
      },
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
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) FROM post_like pl
              WHERE pl.post_id = Post.id
            )`),
            "likeCount",
          ],
          [
            sequelize.literal(`(
              SELECT COUNT(*) FROM post_comment pc
              WHERE pc.post_id = Post.id
            )`),
            "commentCount",
          ],
        ],
      },
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

    const userPk = getUserPk();
    const userId = req.user?.id ?? req.user?.user_id;

    const created = await Post.create({
      user_id: userId,
      content_text: String(content_text || "").trim(),
      media_url: media_url || null,
      visibility,
    });

    const safeUserAttrs = getSafeUserAttributes();

    const full = await Post.findByPk(created[Post.primaryKeyAttribute || "id"], {
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
      attributes: {
        include: [
          [sequelize.literal(`0`), "likeCount"],
          [sequelize.literal(`0`), "commentCount"],
        ],
      },
    });

    res.status(201).json(full || created);
  } catch (e) {
    next(e);
  }
});

// POST /content/posts/:id/like
router.post("/posts/:id/like", auth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = req.user?.id ?? req.user?.user_id;

    const post = await Post.findByPk(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // idempotent
    const existing = await PostLike.findOne({ where: { post_id: postId, user_id: userId } });
    if (existing) return res.json({ ok: true });

    await PostLike.create({ post_id: postId, user_id: userId });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// DELETE /content/posts/:id/like
router.delete("/posts/:id/like", auth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = req.user?.id ?? req.user?.user_id;

    await PostLike.destroy({ where: { post_id: postId, user_id: userId } });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// GET /content/posts/:id/comments
router.get("/posts/:id/comments", async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const safeUserAttrs = getSafeUserAttributes();

    const list = await PostComment.findAll({
      where: { post_id: postId },
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
      order: [["created_at", "ASC"], ["id", "ASC"]],
      limit: 200,
    });

    res.json(list);
  } catch (e) {
    next(e);
  }
});

// POST /content/posts/:id/comments
router.post("/posts/:id/comments", auth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = req.user?.id ?? req.user?.user_id;
    const content_text = String(req.body?.content_text || "").trim();

    if (!content_text) return res.status(400).json({ message: "Comment cannot be empty" });

    const post = await Post.findByPk(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const created = await PostComment.create({
      post_id: postId,
      user_id: userId,
      content_text,
    });

    const safeUserAttrs = getSafeUserAttributes();

    const full = await PostComment.findByPk(created.id, {
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
    });

    res.status(201).json(full || created);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
