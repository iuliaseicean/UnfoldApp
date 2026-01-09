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

function toId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getAuthUserId(req) {
  return req.user?.id ?? req.user?.user_id ?? null;
}

function pickModelFields(model, data) {
  const allowed = new Set(Object.keys(model?.rawAttributes || {}));
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

/**
 * PK pentru Post (id / post_id)
 */
function getPostPkField() {
  if (hasAttr(Post, "id")) return "id";
  if (hasAttr(Post, "post_id")) return "post_id";
  return Post.primaryKeyAttribute || "id";
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

/**
 * Detectează automat alias-ul corect pentru include(User)
 * ca să nu mai ai SequelizeEagerLoadingError.
 */
function makeUserIncludeFor(modelWithAssoc) {
  const safeUserAttrs = getSafeUserAttributes();

  try {
    const assocs = modelWithAssoc?.associations ? Object.values(modelWithAssoc.associations) : [];
    const rel = assocs.find((a) => a?.target?.name === User?.name || a?.target === User);

    if (rel?.as) {
      return { model: User, as: rel.as, attributes: safeUserAttrs, required: false };
    }
  } catch {
    // ignore
  }

  // fallback clasic
  return { model: User, attributes: safeUserAttrs, required: false };
}

/**
 * PostLike columns
 */
function getLikeCols() {
  const postCol = hasAttr(PostLike, "post_id")
    ? "post_id"
    : hasAttr(PostLike, "postId")
    ? "postId"
    : "post_id";

  const userCol = hasAttr(PostLike, "user_id")
    ? "user_id"
    : hasAttr(PostLike, "userId")
    ? "userId"
    : "user_id";

  return { postCol, userCol };
}

/**
 * PostComment columns
 */
function getCommentCols() {
  const postCol = hasAttr(PostComment, "post_id")
    ? "post_id"
    : hasAttr(PostComment, "postId")
    ? "postId"
    : "post_id";

  const userCol = hasAttr(PostComment, "user_id")
    ? "user_id"
    : hasAttr(PostComment, "userId")
    ? "userId"
    : "user_id";

  const textCol = hasAttr(PostComment, "content_text")
    ? "content_text"
    : hasAttr(PostComment, "contentText")
    ? "contentText"
    : "content_text";

  return { postCol, userCol, textCol };
}

/**
 * Sortarea pentru comments: created_at / createdAt / id
 */
function getCommentOrder() {
  if (hasAttr(PostComment, "created_at")) return ["created_at", "ASC"];
  if (hasAttr(PostComment, "createdAt")) return ["createdAt", "ASC"];
  return ["id", "ASC"];
}

/**
 * ✅ Ensure tables exist (DEV FRIENDLY)
 * Dacă primești 208 "Invalid object name 'post_like'" / 'post_comment',
 * înseamnă că tabelele nu există în DB.
 * Aici încercăm să le creăm prin sync() o singură dată.
 */
let ensurePromise = null;
async function ensureSocialTables() {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    // Post (de obicei există deja)
    try {
      await Post.sync();
    } catch {
      // ignore
    }

    // IMPORTANT: astea 2 sunt cele care lipsesc cel mai des
    try {
      await PostLike.sync();
    } catch (e) {
      // lasă să fie prins mai jos când chiar avem nevoie
    }

    try {
      await PostComment.sync();
    } catch (e) {
      // la fel
    }
  })();

  return ensurePromise;
}

/**
 * ✅ enrichCounts (robust):
 * - ia PK real din Post (id / post_id)
 * - numără likes/comments în funcție de coloanele reale din modele
 */
async function enrichCounts(posts) {
  const arr = Array.isArray(posts) ? posts : [];
  const pk = getPostPkField();

  const ids = arr
    .map((p) => (typeof p?.get === "function" ? p.get(pk) : p?.[pk]))
    .filter((x) => x != null);

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
    const { postCol } = getLikeCols();
    const likes = await PostLike.findAll({
      attributes: [postCol, [sequelize.fn("COUNT", sequelize.col(postCol)), "cnt"]],
      where: { [postCol]: ids },
      group: [postCol],
      raw: true,
    });
    likeCounts = Object.fromEntries(likes.map((r) => [Number(r[postCol]), Number(r.cnt || 0)]));
  } catch {
    likeCounts = {};
  }

  // comments
  try {
    const { postCol } = getCommentCols();
    const comments = await PostComment.findAll({
      attributes: [postCol, [sequelize.fn("COUNT", sequelize.col(postCol)), "cnt"]],
      where: { [postCol]: ids },
      group: [postCol],
      raw: true,
    });
    commentCounts = Object.fromEntries(
      comments.map((r) => [Number(r[postCol]), Number(r.cnt || 0)])
    );
  } catch {
    commentCounts = {};
  }

  return arr.map((p) => {
    const json = typeof p?.toJSON === "function" ? p.toJSON() : p;
    const pid = Number(typeof p?.get === "function" ? p.get(pk) : p?.[pk]);

    return {
      ...json,
      likeCount: likeCounts[pid] ?? 0,
      commentCount: commentCounts[pid] ?? 0,
    };
  });
}

/**
 * Helper: count likes/comments pentru un singur post
 */
async function getCountsForPost(postId) {
  const { postCol: likePostCol } = getLikeCols();
  const { postCol: commPostCol } = getCommentCols();

  let likeCount = 0;
  let commentCount = 0;

  try {
    likeCount = await PostLike.count({ where: { [likePostCol]: postId } });
  } catch {
    likeCount = 0;
  }

  try {
    commentCount = await PostComment.count({ where: { [commPostCol]: postId } });
  } catch {
    commentCount = 0;
  }

  return { likeCount, commentCount };
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
    if (hasAttr(Post, "content_text")) whereOr.push({ content_text: { [Op.like]: `%${q}%` } });
    if (hasAttr(Post, "contentText")) whereOr.push({ contentText: { [Op.like]: `%${q}%` } });

    if (!whereOr.length) return res.json([]);

    const userWhereOr = [];
    if (hasAttr(User, "username")) userWhereOr.push({ username: { [Op.like]: `%${q}%` } });
    if (hasAttr(User, "name")) userWhereOr.push({ name: { [Op.like]: `%${q}%` } });

    const includeUserForPost = makeUserIncludeFor(Post);

    // 1) match în text
    const byText = await Post.findAll({
      where: { [Op.or]: whereOr },
      include: [includeUserForPost],
      order: orderByCreated(Post, "DESC"),
      limit: 50,
    });

    // 2) match în user
    let byUser = [];
    if (userWhereOr.length) {
      byUser = await Post.findAll({
        include: [
          {
            ...includeUserForPost,
            required: true,
            where: { [Op.or]: userWhereOr },
          },
        ],
        order: orderByCreated(Post, "DESC"),
        limit: 50,
      });
    }

    // merge unique by PK real
    const pk = getPostPkField();
    const map = new Map();
    for (const p of [...byText, ...byUser]) {
      const key = typeof p?.get === "function" ? p.get(pk) : p?.[pk];
      if (key != null) map.set(Number(key), p);
    }

    const merged = Array.from(map.values()).slice(0, 80);

    // asigură tabelele înainte de count
    await ensureSocialTables();

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
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);
    const includeUserForPost = makeUserIncludeFor(Post);

    const posts = await Post.findAll({
      include: [includeUserForPost],
      order: orderByCreated(Post, "DESC"),
      limit,
    });

    await ensureSocialTables();
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

    const includeUserForPost = makeUserIncludeFor(Post);

    const post = await Post.findByPk(id, {
      include: [includeUserForPost],
    });

    if (!post) return res.status(404).json({ message: "Not found" });

    await ensureSocialTables();
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

    const payload = pickModelFields(Post, {
      user_id: userId,
      userId: userId,
      content_text: String(content_text || "").trim(),
      contentText: String(content_text || "").trim(),
      media_url: media_url || null,
      mediaUrl: media_url || null,
      visibility,
    });

    const created = await Post.create(payload);

    const includeUserForPost = makeUserIncludeFor(Post);
    const pk = getPostPkField();
    const createdId = created?.get?.(pk) ?? created?.[pk] ?? created?.id;

    const full = await Post.findByPk(createdId, { include: [includeUserForPost] });

    await ensureSocialTables();
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
    await ensureSocialTables();

    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const post = await Post.findByPk(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const { postCol, userCol } = getLikeCols();

    // dacă tabela tot nu există, vei primi 208 – îl prindem și îl afișăm clar
    try {
      const existing = await PostLike.findOne({
        where: { [postCol]: postId, [userCol]: userId },
      });

      if (!existing) {
        const likePayload = pickModelFields(PostLike, {
          [postCol]: postId,
          [userCol]: userId,
        });
        await PostLike.create(likePayload);
      }

      const counts = await getCountsForPost(postId);
      return res.json({ ok: true, ...counts });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "Could not persist like. Check DB tables post_like / columns.",
      });
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
    await ensureSocialTables();

    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { postCol, userCol } = getLikeCols();

    try {
      await PostLike.destroy({ where: { [postCol]: postId, [userCol]: userId } });
      const counts = await getCountsForPost(postId);
      return res.json({ ok: true, ...counts });
    } catch {
      return res.status(500).json({
        ok: false,
        error: "Could not persist unlike. Check DB tables post_like / columns.",
      });
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
    await ensureSocialTables();

    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const order1 = getCommentOrder();
    const { postCol } = getCommentCols();

    const includeUserForComment = makeUserIncludeFor(PostComment);

    const list = await PostComment.findAll({
      where: { [postCol]: postId },
      include: [includeUserForComment],
      order: [order1, ["id", "ASC"]],
      limit: 200,
    });

    return res.json(list);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// POST /content/posts/:id/comments
// ─────────────────────────────────────────────
router.post("/posts/:id/comments", auth, async (req, res, next) => {
  try {
    await ensureSocialTables();

    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const content = String(req.body?.content_text ?? req.body?.contentText ?? "").trim();
    if (!content) return res.status(400).json({ message: "Comment cannot be empty" });

    const post = await Post.findByPk(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const { postCol, userCol, textCol } = getCommentCols();

    const payload = pickModelFields(PostComment, {
      [postCol]: postId,
      [userCol]: userId,
      [textCol]: content,
    });

    if (!Object.keys(payload).length) {
      return res.status(500).json({ message: "PostComment model columns mismatch" });
    }

    const created = await PostComment.create(payload);

    const includeUserForComment = makeUserIncludeFor(PostComment);
    const full = await PostComment.findByPk(created.id, { include: [includeUserForComment] });

    const counts = await getCountsForPost(postId);

    return res.status(201).json({
      comment: full || created,
      ...counts,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;