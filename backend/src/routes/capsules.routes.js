const router = require("express").Router();
const auth = require("../middlewares/auth");

const Capsule = require("../models/Capsule");
const User = require("../models/User");
const CapsuleContribution = require("../models/CapsuleContribution");

const {
  refreshCapsuleStatus,
  canUserViewCapsule,
  attemptOpenCapsule,
  createKeyForCapsule,
  joinWithKey,
  getUniqueContributorsCount
} = require("../services/capsule.service");

// CREATE capsule (TIME/CO/KEY)
router.post("/", auth, async (req, res, next) => {
  try {
    const {
      title = null,
      description = null,
      capsule_type = "time",
      open_at = null,
      visibility_duration = null,
      required_contributors = null
    } = req.body || {};

    // validări minimale
    if (!["time", "co", "key"].includes(capsule_type)) {
      return res.status(400).json({ error: "capsule_type must be time|co|key" });
    }

    if (capsule_type === "time" && !open_at) {
      return res.status(400).json({ error: "open_at is required for time capsules" });
    }

    if (capsule_type === "co" && (!required_contributors || required_contributors < 2)) {
      return res.status(400).json({ error: "required_contributors must be >= 2 for co capsules" });
    }

    const created = await Capsule.create({
      creator_id: req.user.id,
      title,
      description,
      capsule_type,
      open_at: open_at ? new Date(open_at) : null,
      visibility_duration: visibility_duration != null ? Number(visibility_duration) : null,
      required_contributors: required_contributors != null ? Number(required_contributors) : null,
      status: "locked"
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// LIST my capsules
router.get("/my", auth, async (req, res, next) => {
  try {
    const list = await Capsule.findAll({
      where: { creator_id: req.user.id },
      order: [["created_at", "DESC"]]
    });

    // refresh status (archiving)
    for (const c of list) await refreshCapsuleStatus(c);

    res.json(list);
  } catch (e) {
    next(e);
  }
});

// GET capsule details (+ contributions if allowed)
router.get("/:id", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    const allowed = await canUserViewCapsule(capsule, req.user.id);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    // contributions (doar dacă e open sau owner)
    const canSeeContent = capsule.status === "open" || capsule.creator_id === req.user.id;

    let contributions = [];
    if (canSeeContent) {
      contributions = await CapsuleContribution.findAll({
        where: { capsule_id: capsule.capsule_id },
        include: [{ model: User, attributes: ["id", "username", "email"] }],
        order: [["created_at", "ASC"]]
      });
    }

    // extra pentru co-caps: contributors count
    let uniqueContributors = null;
    if (capsule.capsule_type === "co") {
      uniqueContributors = await getUniqueContributorsCount(capsule.capsule_id);
    }

    res.json({ capsule, contributions, uniqueContributors });
  } catch (e) {
    next(e);
  }
});

// ADD contribution
router.post("/:id/contributions", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    // nu adăugăm în archived
    if (capsule.status === "archived") {
      return res.status(409).json({ error: "Capsule is archived" });
    }

    // KEY: trebuie acces (sau owner)
    const allowed = await canUserViewCapsule(capsule, req.user.id);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    // ✅ CORECT pentru DB-ul tău:
    // DB: content_text, media_url, user_id
    const { content_text = null, media_url = null } = req.body || {};
    if (!content_text && !media_url) {
      return res.status(400).json({ error: "content_text or media_url required" });
    }

    const created = await CapsuleContribution.create({
      capsule_id: capsule.capsule_id,
      user_id: req.user.id,
      content_text,
      media_url
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// TRY OPEN capsule
router.post("/:id/open", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    // KEY: doar dacă ai acces (sau owner)
    const allowed = await canUserViewCapsule(capsule, req.user.id);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    const result = await attemptOpenCapsule(capsule);

    if (!result.ok) {
      return res.status(409).json({
        error: "Cannot open capsule yet",
        reason: result.reason,
        extra: result.cnt
      });
    }

    res.json(result.capsule);
  } catch (e) {
    next(e);
  }
});

// GENERATE KEY (owner only) for key capsules
router.post("/:id/generate-key", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    if (capsule.creator_id !== req.user.id) {
      return res.status(403).json({ error: "Only owner can generate keys" });
    }

    if (capsule.capsule_type !== "key") {
      return res.status(409).json({ error: "generate-key is only for key capsules" });
    }

    const { expires_at = null } = req.body || {};
    const keyObj = await createKeyForCapsule(capsule.capsule_id, { expiresAt: expires_at });

    res.status(201).json({ key: keyObj.value, expires_at: keyObj.expires_at });
  } catch (e) {
    next(e);
  }
});

// JOIN WITH KEY (auth)
router.post("/:id/join-with-key", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    if (capsule.capsule_type !== "key") {
      return res.status(409).json({ error: "join-with-key is only for key capsules" });
    }

    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: "key is required" });

    const result = await joinWithKey(capsule.capsule_id, req.user.id, key);
    if (!result.ok) return res.status(403).json({ error: "Invalid or expired key" });

    res.json({ message: "Access granted" });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
