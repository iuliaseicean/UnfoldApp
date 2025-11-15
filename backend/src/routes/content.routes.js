const router = require("express").Router();
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middlewares/auth");

// LIST posts
router.get("/posts", async (req, res, next) => {
  try {
    const list = await Post.findAll({
      include: [{ model: User, attributes: ["user_id","name","avatar_url"] }],
      order: [["created_at", "DESC"]],
      limit: 100
    });
    res.json(list);
  } catch (e) { next(e); }
});

// GET post by id
router.get("/posts/:id", async (req, res, next) => {
  try {
    const item = await Post.findByPk(req.params.id, {
      include: [{ model: User, attributes: ["user_id","name","avatar_url"] }]
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (e) { next(e); }
});

// CREATE post
router.post("/posts", auth, async (req, res, next) => {
  try {
    const { content_text = "", media_url = null, visibility = "public" } = req.body || {};
    const created = await Post.create({
      user_id: req.user.id,
      content_text, media_url, visibility
    });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

module.exports = router;
