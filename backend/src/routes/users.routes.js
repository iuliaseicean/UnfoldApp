// backend/src/routes/users.routes.js
const router = require("express").Router();
const { Op } = require("sequelize");
const auth = require("../middlewares/auth");

const User = require("../models/User");

// ✅ Varianta A: tabelă separată pt privacy
let UserSettings = null;
try {
  UserSettings = require("../models/UserSettings");
} catch {
  UserSettings = null;
}

// OPTIONAL (dar recomandat pentru profil)
let Post = null;
let PostLike = null;
let PostComment = null;

try {
  Post = require("../models/Post");
} catch {
  Post = null;
}

try {
  PostLike = require("../models/PostLike");
} catch {
  PostLike = null;
}

try {
  PostComment = require("../models/PostComment");
} catch {
  PostComment = null;
}

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

function getUserPkField() {
  if (hasAttr(User, "id")) return "id";
  if (hasAttr(User, "user_id")) return "user_id";
  return User.primaryKeyAttribute || "id";
}

function getSafeUserAttributes() {
  const safe = [];

  if (hasAttr(User, "id")) safe.push("id");
  if (hasAttr(User, "user_id")) safe.push("user_id");

  if (hasAttr(User, "username")) safe.push("username");
  if (hasAttr(User, "name")) safe.push("name");
  if (hasAttr(User, "email")) safe.push("email");

  if (hasAttr(User, "bio")) safe.push("bio");
  if (hasAttr(User, "avatar_url")) safe.push("avatar_url");

  if (hasAttr(User, "created_at")) safe.push("created_at");
  if (hasAttr(User, "updated_at")) safe.push("updated_at");
  if (hasAttr(User, "createdAt")) safe.push("createdAt");
  if (hasAttr(User, "updatedAt")) safe.push("updatedAt");

  return safe.length ? safe : undefined;
}

function getSearchFields() {
  const fields = [];
  if (hasAttr(User, "username")) fields.push("username");
  if (hasAttr(User, "name")) fields.push("name");
  if (hasAttr(User, "email")) fields.push("email");
  return fields;
}

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

function getDefaultUserOrder() {
  const pk = getUserPkField();
  if (hasAttr(User, "username")) return [["username", "ASC"]];
  return [[pk, "ASC"]];
}

/* ───────────────────── Post helpers (optional) ───────────────────── */

function getPostPkField() {
  if (!Post) return "id";
  if (hasAttr(Post, "id")) return "id";
  if (hasAttr(Post, "post_id")) return "post_id";
  return Post.primaryKeyAttribute || "id";
}

function getPostOwnerField() {
  if (!Post) return "user_id";
  if (hasAttr(Post, "user_id")) return "user_id";
  if (hasAttr(Post, "userId")) return "userId";
  return "user_id";
}

function getPostOrderField() {
  if (!Post) return "id";
  if (hasAttr(Post, "created_at")) return "created_at";
  if (hasAttr(Post, "createdAt")) return "createdAt";
  return Post.primaryKeyAttribute || "id";
}

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

  return { model: User, attributes: safeUserAttrs, required: false };
}

function getLikeCols() {
  if (!PostLike) return { postCol: "post_id", userCol: "user_id" };

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
  if (!PostComment) return { postCol: "post_id", userCol: "user_id" };

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

  return { postCol, userCol };
}

/* ───────────────────── privacy (UserSettings) ───────────────────── */

async function getIsPrivateForUserId(userId) {
  if (!UserSettings) return false;

  try {
    const row = await UserSettings.findOne({
      where: { user_id: Number(userId) },
      attributes: ["is_private"],
      raw: true,
    });
    return !!row?.is_private;
  } catch {
    // tabelă lipsă / permisiuni / orice -> fallback public
    return false;
  }
}

async function getPrivacyMap(userIds) {
  const ids = (Array.isArray(userIds) ? userIds : [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);

  const map = new Map();
  for (const id of ids) map.set(id, false);

  if (!ids.length || !UserSettings) return map;

  try {
    const rows = await UserSettings.findAll({
      where: { user_id: ids },
      attributes: ["user_id", "is_private"],
      raw: true,
    });
    for (const r of rows) {
      map.set(Number(r.user_id), !!r.is_private);
    }
  } catch {
    // ignore
  }

  return map;
}

async function upsertIsPrivateForUserId(userId, isPrivate) {
  if (!UserSettings) return;

  const payload = { user_id: Number(userId), is_private: !!isPrivate };

  // upsert dacă există
  try {
    if (typeof UserSettings.upsert === "function") {
      await UserSettings.upsert(payload);
      return;
    }
  } catch {
    // fallback mai jos
  }

  // fallback: findOrCreate + update
  try {
    const [row] = await UserSettings.findOrCreate({
      where: { user_id: Number(userId) },
      defaults: payload,
    });
    await row.update({ is_private: !!isPrivate });
  } catch {
    // ignore
  }
}

/* ───────────────────── enrich posts (optional) ───────────────────── */

async function enrichPostsForProfile(req, posts) {
  const arr = Array.isArray(posts) ? posts : [];
  const pk = getPostPkField();
  const ownerField = getPostOwnerField();
  const authUserId = getAuthUserId(req);

  const ids = arr
    .map((p) => (typeof p?.get === "function" ? p.get(pk) : p?.[pk]))
    .filter((x) => x != null);

  let likeCounts = {};
  let commentCounts = {};

  if (ids.length && PostLike) {
    try {
      const { postCol } = getLikeCols();
      const rows = await PostLike.findAll({
        attributes: [
          postCol,
          [PostLike.sequelize.fn("COUNT", PostLike.sequelize.col(postCol)), "cnt"],
        ],
        where: { [postCol]: ids },
        group: [postCol],
        raw: true,
      });
      likeCounts = Object.fromEntries(rows.map((r) => [Number(r[postCol]), Number(r.cnt || 0)]));
    } catch {}
  }

  if (ids.length && PostComment) {
    try {
      const { postCol } = getCommentCols();
      const rows = await PostComment.findAll({
        attributes: [
          postCol,
          [PostComment.sequelize.fn("COUNT", PostComment.sequelize.col(postCol)), "cnt"],
        ],
        where: { [postCol]: ids },
        group: [postCol],
        raw: true,
      });
      commentCounts = Object.fromEntries(
        rows.map((r) => [Number(r[postCol]), Number(r.cnt || 0)])
      );
    } catch {}
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

/* ───────────────────── routes ───────────────────── */

// GET /users/me
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

    const is_private = await getIsPrivateForUserId(Number(myId));

    return res.json({
      ...me.toJSON(),
      is_private,
    });
  } catch (e) {
    next(e);
  }
});

// PATCH /users/me  (include privacy toggle)
router.patch("/me", auth, async (req, res, next) => {
  try {
    const pk = getUserPkField();
    const myId = getAuthUserId(req);
    if (!myId) return res.status(401).json({ error: "Unauthorized" });

    const me = await User.findOne({ where: { [pk]: myId } });
    if (!me) return res.status(404).json({ error: "User not found" });

    const { username, bio, email, name, avatar_url, is_private, isPrivate } = req.body || {};

    // username + unique
    if (typeof username === "string" && hasAttr(User, "username")) {
      const u = username.trim();
      if (u.length < 2) return res.status(400).json({ error: "username too short" });

      const exists = await User.findOne({
        where: { username: u, [pk]: { [Op.ne]: me.get(pk) } },
      });
      if (exists) return res.status(409).json({ error: "Username already in use" });

      me.username = u;
    }

    if (typeof name === "string" && hasAttr(User, "name")) me.name = name.trim();
    if (typeof bio === "string" && hasAttr(User, "bio")) me.bio = bio.trim();
    if (typeof avatar_url === "string" && hasAttr(User, "avatar_url")) me.avatar_url = avatar_url.trim();

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

    // ✅ privacy toggle în UserSettings
    const incoming =
      typeof is_private === "boolean"
        ? is_private
        : typeof isPrivate === "boolean"
        ? isPrivate
        : null;

    if (incoming !== null) {
      await upsertIsPrivateForUserId(Number(myId), incoming);
    }

    const safe = await User.findOne({
      where: { [pk]: myId },
      attributes: getSafeUserAttributes(),
    });

    const freshPrivate = await getIsPrivateForUserId(Number(myId));

    return res.json({
      ...(safe ? safe.toJSON() : {}),
      is_private: freshPrivate,
    });
  } catch (e) {
    next(e);
  }
});

// GET /users/search?q=
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

    // atașăm is_private (Varianta A)
    const pk = getUserPkField();
    const ids = list
      .map((u) => Number(u?.get?.(pk) ?? u?.[pk]))
      .filter((x) => Number.isFinite(x) && x > 0);

    const privacyMap = await getPrivacyMap(ids);

    return res.json(
      list.map((u) => {
        const json = typeof u?.toJSON === "function" ? u.toJSON() : u;
        const id = Number(u?.get?.(pk) ?? u?.[pk]);
        return { ...json, is_private: privacyMap.get(id) ?? false };
      })
    );
  } catch (e) {
    next(e);
  }
});

// GET /users/:id/posts
router.get("/:id/posts", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid user id" });

    if (!Post) return res.json([]);

    const meId = getAuthUserId(req);
    if (!meId) return res.status(401).json({ error: "Unauthorized" });

    const pk = getUserPkField();

    const user = await User.findOne({
      where: { [pk]: id },
      attributes: getSafeUserAttributes(),
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isPrivate = await getIsPrivateForUserId(Number(id));
    if (isPrivate && Number(meId) !== Number(id)) {
      return res.status(403).json({ error: "This profile is private" });
    }

    const ownerField = getPostOwnerField();
    const includeUserForPost = makeUserIncludeFor(Post);

    const list = await Post.findAll({
      where: { [ownerField]: id },
      include: [includeUserForPost],
      order: [[getPostOrderField(), "DESC"]],
      limit: 50,
    });

    const enriched = await enrichPostsForProfile(req, list);
    return res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// GET /users/:id
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

    const is_private = await getIsPrivateForUserId(Number(id));

    return res.json({
      ...user.toJSON(),
      is_private,
    });
  } catch (e) {
    next(e);
  }
});

// GET /users?query=... (compat)
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

    // atașăm is_private
    const pk = getUserPkField();
    const ids = list
      .map((u) => Number(u?.get?.(pk) ?? u?.[pk]))
      .filter((x) => Number.isFinite(x) && x > 0);

    const privacyMap = await getPrivacyMap(ids);

    return res.json(
      list.map((u) => {
        const json = typeof u?.toJSON === "function" ? u.toJSON() : u;
        const id = Number(u?.get?.(pk) ?? u?.[pk]);
        return { ...json, is_private: privacyMap.get(id) ?? false };
      })
    );
  } catch (e) {
    next(e);
  }
});

module.exports = router;