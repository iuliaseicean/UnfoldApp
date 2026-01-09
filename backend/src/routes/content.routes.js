// backend/src/routes/content.routes.js
require("dotenv").config();
const router = require("express").Router();
const auth = require("../middlewares/auth");
const { Op } = require("sequelize");

const Post = require("../models/Post");
const User = require("../models/User");
const PostLike = require("../models/PostLike");
const PostComment = require("../models/PostComment");

const { sequelize } = require("../config/db");

/**
 * Helpers: compatibil snake_case / camelCase + DB diferit
 */
function hasAttr(model, name) {
  return !!model?.rawAttributes?.[name];
}

function getOrderField(model) {
  if (hasAttr(model, "created_at")) return "created_at";
  if (hasAttr(model, "createdAt")) return "createdAt";
  return model?.primaryKeyAttribute || "id";
}

function orderByCreated(model, dir = "DESC") {
  return [[getOrderField(model), dir]];
}

function getSafeUserAttributes() {
  const safe = [];
  if (hasAttr(User, "id")) safe.push("id");
  if (hasAttr(User, "user_id")) safe.push("user_id");
  if (hasAttr(User, "username")) safe.push("username");
  if (hasAttr(User, "name")) safe.push("name");
  if (hasAttr(User, "email")) safe.push("email");
  if (hasAttr(User, "avatar_url")) safe.push("avatar_url");
  if (hasAttr(User, "bio")) safe.push("bio");
  return safe.length ? safe : undefined;
}

function getAuthUserId(req) {
  return req.user?.id ?? req.user?.user_id ?? null;
}

function toId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickArr(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.posts)) return raw.posts;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

/**
 * Alege sortarea pentru comments: created_at / createdAt / id
 */
function getCommentOrder() {
  if (hasAttr(PostComment, "created_at")) return ["created_at", "ASC"];
  if (hasAttr(PostComment, "createdAt")) return ["createdAt", "ASC"];
  return ["id", "ASC"];
}

/**
 * IMPORTANT: în MSSQL eroarea ta inițială a fost "Invalid object name 'post_like'".
 * Deci NU mai folosim subquery literal cu numele tabelei hardcodat.
 * Facem COUNT via modele (PostLike/PostComment). Dacă tabela lipsește, fallback 0.
 */
async function enrichCounts(posts) {
  const arr = Array.isArray(posts) ? posts : [];
  const ids = arr.map((p) => p?.id).filter(Boolean);

  if (!ids.length) {
    return arr.map((p) => ({
      ...(typeof p?.toJSON === "function" ? p.toJSON() : p),
      likeCount: 0,
      commentCount: 0,
    }));
  }

  let likeCounts = {};
  let commentCounts = {};

  // likes
  try {
    const postIdCol = hasAttr(PostLike, "post_id") ? "post_id" : "postId";
    const likes = await PostLike.findAll({
      attributes: [postIdCol, [sequelize.fn("COUNT", sequelize.col(postIdCol)), "cnt"]],
      where: { [postIdCol]: ids },
      group: [postIdCol],
      raw: true,
    });

    likeCounts = Object.fromEntries(
      likes.map((r) => [Number(r[postIdCol]), Number(r.cnt || 0)])
    );
  } catch {
    likeCounts = {};
  }

  // comments
  try {
    const postIdCol = hasAttr(PostComment, "post_id") ? "post_id" : "postId";
    const comments = await PostComment.findAll({
      attributes: [postIdCol, [sequelize.fn("COUNT", sequelize.col(postIdCol)), "cnt"]],
      where: { [postIdCol]: ids },
      group: [postIdCol],
      raw: true,
    });

    commentCounts = Object.fromEntries(
      comments.map((r) => [Number(r[postIdCol]), Number(r.cnt || 0)])
    );
  } catch {
    commentCounts = {};
  }

  return arr.map((p) => {
    const json = typeof p?.toJSON === "function" ? p.toJSON() : p;
    return {
      ...json,
      likeCount: likeCounts[p.id] ?? 0,
      commentCount: commentCounts[p.id] ?? 0,
    };
  });
}

// ─────────────────────────────────────────────
// IMPORTANT: /posts/search trebuie să fie ÎNAINTE de /posts/:id
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// SEARCH POSTS
// GET /content/posts/search?q=...
// ─────────────────────────────────────────────
router.get("/posts/search", auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);

    const whereOr = [];

    // text
    if (hasAttr(Post, "content_text")) whereOr.push({ content_text: { [Op.like]: `%${q}%` } });
    if (hasAttr(Post, "contentText")) whereOr.push({ contentText: { [Op.like]: `%${q}%` } });

    if (!whereOr.length) return res.json([]);

    const safeUserAttrs = getSafeUserAttributes();

    // include user și permite căutare și pe username/name dacă există
    const userWhereOr = [];
    if (hasAttr(User, "username")) userWhereOr.push({ username: { [Op.like]: `%${q}%` } });
    if (hasAttr(User, "name")) userWhereOr.push({ name: { [Op.like]: `%${q}%` } });

    const includeUser =
      userWhereOr.length > 0
        ? [
            {
              model: User,
              attributes: safeUserAttrs,
              required: false,
              where: { [Op.or]: userWhereOr },
            },
          ]
        : [{ model: User, attributes: safeUserAttrs, required: false }];

    // Ca să includă și posts unde match e în text (nu doar în user),
    // facem două query-uri mici și le unim (MVP sigur).
    // 1) match în post text
    const byText = await Post.findAll({
      where: { [Op.or]: whereOr },
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
      order: orderByCreated(Post, "DESC"),
      limit: 50,
    });

    // 2) match în user (dacă avem pe ce)
    let byUser = [];
    if (userWhereOr.length) {
      byUser = await Post.findAll({
        include: includeUser,
        order: orderByCreated(Post, "DESC"),
        limit: 50,
      });
    }

    // merge unique by id
    const map = new Map();
    for (const p of [...byText, ...byUser]) map.set(p.id, p);
    const merged = Array.from(map.values()).slice(0, 80);

    const enriched = await enrichCounts(merged);
    return res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// GET /content/posts  -> feed
// ─────────────────────────────────────────────
router.get("/posts", async (req, res, next) => {
  try {
    const safeUserAttrs = getSafeUserAttributes();

    // optional ?limit=...
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);

    const posts = await Post.findAll({
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
      order: orderByCreated(Post, "DESC"),
      limit,
    });

    const enriched = await enrichCounts(posts);
    return res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// GET /content/posts/:id
// ─────────────────────────────────────────────
router.get("/posts/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid post id" });

    const safeUserAttrs = getSafeUserAttributes();

    const post = await Post.findByPk(id, {
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
    });

    if (!post) return res.status(404).json({ message: "Not found" });

    const [enriched] = await enrichCounts([post]);
    return res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// POST /content/posts  -> creare postare
// ─────────────────────────────────────────────
router.post("/posts", auth, async (req, res, next) => {
  try {
    const { content_text = "", media_url = null, visibility = "public" } = req.body || {};

    if (!String(content_text || "").trim() && !media_url) {
      return res.status(400).json({ message: "Post must have text or media" });
    }

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // compat: user_id / userId
    const payload = {};
    if (hasAttr(Post, "user_id")) payload.user_id = userId;
    else if (hasAttr(Post, "userId")) payload.userId = userId;

    if (hasAttr(Post, "content_text")) payload.content_text = String(content_text || "").trim();
    else if (hasAttr(Post, "contentText")) payload.contentText = String(content_text || "").trim();

    if (hasAttr(Post, "media_url")) payload.media_url = media_url || null;
    else if (hasAttr(Post, "mediaUrl")) payload.mediaUrl = media_url || null;

    if (hasAttr(Post, "visibility")) payload.visibility = visibility;

    const created = await Post.create(payload);

    const safeUserAttrs = getSafeUserAttributes();
    const full = await Post.findByPk(created.id, {
      include: [{ model: User, attributes: safeUserAttrs, required: false }],
    });

    const [enriched] = await enrichCounts([full || created]);
    return res.status(201).json(enriched);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// POST /content/posts/:id/like
// ─────────────────────────────────────────────
router.post("/posts/:id/like", auth, async (req, res, next) => {
  try {
    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const post = await Post.findByPk(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    try {
      const postIdCol = hasAttr(PostLike, "post_id") ? "post_id" : "postId";
      const userIdCol = hasAttr(PostLike, "user_id") ? "user_id" : "userId";

      const existing = await PostLike.findOne({
        where: { [postIdCol]: postId, [userIdCol]: userId },
      });
      if (existing) return res.json({ ok: true });

      await PostLike.create({ [postIdCol]: postId, [userIdCol]: userId });
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: true, warning: "likes table missing in DB" });
    }
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// DELETE /content/posts/:id/like
// ─────────────────────────────────────────────
router.delete("/posts/:id/like", auth, async (req, res, next) => {
  try {
    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const postIdCol = hasAttr(PostLike, "post_id") ? "post_id" : "postId";
      const userIdCol = hasAttr(PostLike, "user_id") ? "user_id" : "userId";

      await PostLike.destroy({ where: { [postIdCol]: postId, [userIdCol]: userId } });
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: true, warning: "likes table missing in DB" });
    }
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// GET /content/posts/:id/comments
// ─────────────────────────────────────────────
router.get("/posts/:id/comments", async (req, res, next) => {
  try {
    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const safeUserAttrs = getSafeUserAttributes();
    const order1 = getCommentOrder();

    try {
      const postIdCol = hasAttr(PostComment, "post_id") ? "post_id" : "postId";

      const list = await PostComment.findAll({
        where: { [postIdCol]: postId },
        include: [{ model: User, attributes: safeUserAttrs, required: false }],
        order: [order1, ["id", "ASC"]],
        limit: 200,
      });

      return res.json(list);
    } catch {
      return res.json([]);
    }
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// POST /content/posts/:id/comments
// ─────────────────────────────────────────────
router.post("/posts/:id/comments", auth, async (req, res, next) => {
  try {
    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const content_text = String(req.body?.content_text || "").trim();
    if (!content_text) return res.status(400).json({ message: "Comment cannot be empty" });

    const post = await Post.findByPk(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    try {
      const payload = {};
      const postIdCol = hasAttr(PostComment, "post_id") ? "post_id" : "postId";
      const userIdCol = hasAttr(PostComment, "user_id") ? "user_id" : "userId";
      const textCol = hasAttr(PostComment, "content_text") ? "content_text" : "contentText";

      payload[postIdCol] = postId;
      payload[userIdCol] = userId;
      payload[textCol] = content_text;

      const created = await PostComment.create(payload);

      const safeUserAttrs = getSafeUserAttributes();
      const full = await PostComment.findByPk(created.id, {
        include: [{ model: User, attributes: safeUserAttrs, required: false }],
      });

      return res.status(201).json(full || created);
    } catch {
      return res.status(201).json({ ok: true, warning: "comments table missing in DB" });
    }
  } catch (e) {
    next(e);
  }
});

module.exports = router;