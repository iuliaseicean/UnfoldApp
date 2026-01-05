const router = require("express").Router();
const auth = require("../middlewares/auth");

const Capsule = require("../models/Capsule");
const Post = require("../models/Post");
const User = require("../models/User");

const { sequelize } = require("../config/db");

function parseTs(v) {
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

function getSafeUserAttributes() {
  const u = User?.rawAttributes || {};
  const safe = [];
  if (u.id) safe.push("id");
  if (u.username) safe.push("username");
  if (u.email) safe.push("email");
  if (u.name) safe.push("name");
  if (u.avatar_url) safe.push("avatar_url");
  return safe.length ? safe : undefined;
}

// GET /feed  (capsules + posts) auth
router.get("/", auth, async (req, res, next) => {
  try {
    const safeUserAttrs = getSafeUserAttributes();

    const [capsules, posts] = await Promise.all([
      Capsule.findAll({
        where: { creator_id: req.user.id },
        order: [["created_at", "DESC"]],
        limit: 100,
      }),
      Post.findAll({
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
        order: [["created_at", "DESC"]],
        limit: 100,
      }),
    ]);

    const feed = [
      ...capsules.map((c) => ({
        type: "capsule",
        ts: parseTs(c.created_at || c.open_at || ""),
        created_at: c.created_at,
        data: c,
      })),
      ...posts.map((p) => ({
        type: "post",
        ts: parseTs(p.created_at || p.createdAt || ""),
        created_at: p.created_at || p.createdAt,
        data: p,
      })),
    ].sort((a, b) => (b.ts || 0) - (a.ts || 0));

    res.json(feed);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
