// backend/src/routes/content.routes.js
require("dotenv").config();
const router = require("express").Router();
const auth = require("../middlewares/auth");
const { Op } = require("sequelize");

const Post = require("../models/Post");
const User = require("../models/User");
const PostLike = require("../models/PostLike");
const PostComment = require("../models/PostComment");

// ✅ Varianta A: tabelă separată pentru privacy
let UserSettings = null;
try {
  UserSettings = require("../models/UserSettings");
} catch {
  UserSettings = null;
}

const { sequelize } = require("../config/db");

/* ───────────────────── helpers ───────────────────── */

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

/**
 * Owner field pentru Post (user_id / userId)
 */
function getPostOwnerField() {
  if (hasAttr(Post, "user_id")) return "user_id";
  if (hasAttr(Post, "userId")) return "userId";
  return "user_id";
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
 * include(User) robust (alias-safe)
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

  // fallback
  return { model: User, attributes: safeUserAttrs, required: false };
}

/* ───────────────────── likes/comments cols ───────────────────── */

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

function getCommentOrder() {
  if (hasAttr(PostComment, "created_at")) return ["created_at", "ASC"];
  if (hasAttr(PostComment, "createdAt")) return ["createdAt", "ASC"];
  return ["id", "ASC"];
}

/* ───────────────────── ensure tables (dev-friendly) ───────────────────── */

let ensurePromise = null;
async function ensureSocialTables() {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      await Post.sync();
    } catch {}
    try {
      await PostLike.sync();
    } catch {}
    try {
      await PostComment.sync();
    } catch {}
    if (UserSettings) {
      try {
        await UserSettings.sync();
      } catch {}
    }
  })();

  return ensurePromise;
}

/* ───────────────────── privacy (VARIANTA A) ───────────────────── */

/**
 * Returnează Set(user_id) care sunt PRIVATE, din lista dată.
 */
async function getPrivateUserIdSet(userIds) {
  const ids = (Array.isArray(userIds) ? userIds : [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);

  if (!ids.length) return new Set();
  if (!UserSettings) return new Set(); // fallback: totul public

  try {
    const rows = await UserSettings.findAll({
      where: { user_id: ids, is_private: true },
      attributes: ["user_id"],
      raw: true,
    });
    return new Set(rows.map((r) => Number(r.user_id)));
  } catch {
    return new Set();
  }
}

/**
 * Filtru privacy pe posts:
 * - dacă owner e privat -> ascunde postarea pentru oricine NU e owner
 * - dacă owner e public -> păstrează
 */
async function filterPostsByPrivacy(req, posts) {
  const meId = Number(getAuthUserId(req) || 0);
  const ownerField = getPostOwnerField();
  const arr = Array.isArray(posts) ? posts : [];

  // extragem owner ids
  const owners = arr
    .map((p) => {
      const json = typeof p?.toJSON === "function" ? p.toJSON() : p;
      return Number(
        json?.[ownerField] ?? (typeof p?.get === "function" ? p.get(ownerField) : p?.[ownerField])
      );
    })
    .filter((x) => Number.isFinite(x) && x > 0);

  const privateSet = await getPrivateUserIdSet(owners);

  return arr.filter((p) => {
    const json = typeof p?.toJSON === "function" ? p.toJSON() : p;
    const ownerId = Number(
      json?.[ownerField] ?? (typeof p?.get === "function" ? p.get(ownerField) : p?.[ownerField])
    );

    if (!ownerId) return false;

    // public -> ok
    if (!privateSet.has(ownerId)) return true;

    // privat -> doar owner vede
    return meId && ownerId === meId;
  });
}

/* ───────────────────── enrich counts + canDelete ───────────────────── */

async function enrichCounts(req, posts) {
  const arr = Array.isArray(posts) ? posts : [];
  const pk = getPostPkField();
  const ownerField = getPostOwnerField();
  const authUserId = getAuthUserId(req);

  const ids = arr
    .map((p) => (typeof p?.get === "function" ? p.get(pk) : p?.[pk]))
    .filter((x) => x != null);

  if (!ids.length) {
    return arr.map((p) => ({
      ...(typeof p?.toJSON === "function" ? p.toJSON() : p),
      likeCount: 0,
      commentCount: 0,
      canDelete: false,
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

    const ownerId = Number(
      json?.[ownerField] ?? (typeof p?.get === "function" ? p.get(ownerField) : p?.[ownerField])
    );

    return {
      ...json,
      likeCount: likeCounts[pid] ?? 0,
      commentCount: commentCounts[pid] ?? 0,
      canDelete: !!authUserId && ownerId === Number(authUserId),
    };
  });
}

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

/* ───────────────────── routes ───────────────────── */

// IMPORTANT: /posts/search înainte de /posts/:id

// SEARCH POSTS
router.get("/posts/search", auth, async (req, res, next) => {
  try {
    await ensureSocialTables();

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

    // 1) match in text
    const byText = await Post.findAll({
      where: { [Op.or]: whereOr },
      include: [includeUserForPost],
      order: orderByCreated(Post, "DESC"),
      limit: 120,
    });

    // 2) match in user
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
        limit: 120,
      });
    }

    // merge unique
    const pk = getPostPkField();
    const map = new Map();
    for (const p of [...byText, ...byUser]) {
      const key = typeof p?.get === "function" ? p.get(pk) : p?.[pk];
      if (key != null) map.set(Number(key), p);
    }

    let merged = Array.from(map.values());

    // ✅ PRIVACY FILTER (server-side, sigur)
    merged = await filterPostsByPrivacy(req, merged);

    merged = merged.slice(0, 120);

    const enriched = await enrichCounts(req, merged);
    return res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// FEED POSTS
router.get("/posts", auth, async (req, res, next) => {
  try {
    await ensureSocialTables();

    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);

    // luăm un buffer mai mare ca să putem filtra fără să rămâi cu feed gol
    const fetchLimit = Math.min(limit * 3, 500);

    const includeUserForPost = makeUserIncludeFor(Post);

    let posts = await Post.findAll({
      include: [includeUserForPost],
      order: orderByCreated(Post, "DESC"),
      limit: fetchLimit,
    });

    // ✅ PRIVACY FILTER (server-side, sigur)
    posts = await filterPostsByPrivacy(req, posts);

    // după filtrare, tăiem la limit
    posts = posts.slice(0, limit);

    const enriched = await enrichCounts(req, posts);
    return res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// GET SINGLE POST (respectă privacy)
router.get("/posts/:id", auth, async (req, res, next) => {
  try {
    await ensureSocialTables();

    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid post id" });

    const includeUserForPost = makeUserIncludeFor(Post);

    const post = await Post.findByPk(id, { include: [includeUserForPost] });
    if (!post) return res.status(404).json({ message: "Not found" });

    const filtered = await filterPostsByPrivacy(req, [post]);
    if (!filtered.length) return res.status(403).json({ message: "This profile is private" });

    const [enriched] = await enrichCounts(req, filtered);
    return res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// CREATE POST
router.post("/posts", auth, async (req, res, next) => {
  try {
    await ensureSocialTables();

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

    const [enriched] = await enrichCounts(req, [full || created]);
    return res.status(201).json(enriched);
  } catch (e) {
    next(e);
  }
});

// DELETE POST
router.delete("/posts/:id", auth, async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    await ensureSocialTables();

    const postId = toId(req.params.id);
    if (!postId) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid post id" });
    }

    const userId = getAuthUserId(req);
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const post = await Post.findByPk(postId, { transaction: t });
    if (!post) {
      await t.rollback();
      return res.status(404).json({ message: "Post not found" });
    }

    const ownerField = getPostOwnerField();
    const ownerId = Number(post?.get?.(ownerField) ?? post?.[ownerField]);

    if (ownerId !== Number(userId)) {
      await t.rollback();
      return res.status(403).json({ message: "You can delete only your posts" });
    }

    const { postCol: likePostCol } = getLikeCols();
    const { postCol: commPostCol } = getCommentCols();

    await PostLike.destroy({ where: { [likePostCol]: postId }, transaction: t });
    await PostComment.destroy({ where: { [commPostCol]: postId }, transaction: t });

    await Post.destroy({ where: { [getPostPkField()]: postId }, transaction: t });

    await t.commit();
    return res.json({ ok: true });
  } catch (e) {
    await t.rollback();
    next(e);
  }
});

// LIKE
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

    const existing = await PostLike.findOne({ where: { [postCol]: postId, [userCol]: userId } });
    if (!existing) {
      const likePayload = pickModelFields(PostLike, { [postCol]: postId, [userCol]: userId });
      await PostLike.create(likePayload);
    }

    const counts = await getCountsForPost(postId);
    return res.json({ ok: true, ...counts });
  } catch (e) {
    next(e);
  }
});

// UNLIKE
router.delete("/posts/:id/like", auth, async (req, res, next) => {
  try {
    await ensureSocialTables();

    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { postCol, userCol } = getLikeCols();

    await PostLike.destroy({ where: { [postCol]: postId, [userCol]: userId } });
    const counts = await getCountsForPost(postId);
    return res.json({ ok: true, ...counts });
  } catch (e) {
    next(e);
  }
});

// COMMENTS LIST
router.get("/posts/:id/comments", async (req, res, next) => {
  try {
    await ensureSocialTables();

    const postId = toId(req.params.id);
    if (!postId) return res.status(400).json({ message: "Invalid post id" });

    const { postCol } = getCommentCols();
    const includeUserForComment = makeUserIncludeFor(PostComment);

    const list = await PostComment.findAll({
      where: { [postCol]: postId },
      include: [includeUserForComment],
      order: [getCommentOrder(), ["id", "ASC"]],
      limit: 200,
    });

    return res.json(list);
  } catch (e) {
    next(e);
  }
});

// ADD COMMENT
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

    const created = await PostComment.create(payload);

    const includeUserForComment = makeUserIncludeFor(PostComment);
    const full = await PostComment.findByPk(created.id, { include: [includeUserForComment] });

    const counts = await getCountsForPost(postId);

    return res.status(201).json({ comment: full || created, ...counts });
  } catch (e) {
    next(e);
  }
});

module.exports = router;