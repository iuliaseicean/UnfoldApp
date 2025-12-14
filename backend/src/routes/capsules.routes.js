const router = require("express").Router();
const auth = require("../middlewares/auth");

const Capsule = require("../models/Capsule");
const User = require("../models/User");
const CapsuleContribution = require("../models/CapsuleContribution");
const CapsuleKey = require("../models/CapsuleKey");

const {
  refreshCapsuleStatus,
  canUserViewCapsule,
  attemptOpenCapsule,
  createKeyForCapsule,
  joinWithKey,
  getUniqueContributorsCount,
} = require("../services/capsule.service");

/**
 * Helper: APP_URL pentru payload-ul QR (NU îl salvăm în DB)
 * Pune în backend/.env:
 * APP_URL=https://xxxx.ngrok-free.app
 */
function getAppUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL;

  const host = req.get("host");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  return `${proto}://${host}`;
}

function qrPayloadForCapsule(req, capsuleId) {
  // IMPORTANT: acesta trebuie să corespundă cu ruta expo-router:
  // app/capsule/key/[id].tsx  =>  /capsule/key/:id
  return `${getAppUrl(req)}/capsule/key/${capsuleId}`;
}

/**
 * Filtrăm payload-ul doar pe coloanele existente în model
 * ca să nu crape pe DB cu "invalid column".
 */
function pickModelFields(model, data) {
  const allowed = new Set(Object.keys(model.rawAttributes || {}));
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

// ─────────────────────────────────────────────
// CREATE capsule (TIME/CO/KEY)
// ─────────────────────────────────────────────
router.post("/", auth, async (req, res, next) => {
  try {
    const {
      title = null,
      description = null,
      capsule_type = "time",
      open_at = null,
      visibility_duration = null,
      required_contributors = null,

      // KEY only:
      key_plain = null,     // parola aleasă de creator
      media_url = null,     // POZA (URL de la /upload)
      key_expires_at = null,
    } = req.body || {};

    if (!["time", "co", "key"].includes(capsule_type)) {
      return res.status(400).json({ error: "capsule_type must be time|co|key" });
    }

    if (capsule_type === "time" && !open_at) {
      return res.status(400).json({ error: "open_at is required for time capsules" });
    }

    if (capsule_type === "co" && (!required_contributors || Number(required_contributors) < 2)) {
      return res.status(400).json({ error: "required_contributors must be >= 2 for co capsules" });
    }

    // ✅ KEY capsule: trebuie cheie + poză
    if (capsule_type === "key") {
      if (!key_plain || !String(key_plain).trim()) {
        return res.status(400).json({ error: "key_plain is required for key capsules" });
      }
      if (!media_url || !String(media_url).trim()) {
        return res.status(400).json({ error: "media_url (image url) is required for key capsules" });
      }
    }

    // ⚠ IMPORTANT:
    // Capsule model-ul tău NU are media_url/cover_url,
    // deci NU încercăm să le salvăm aici.
    const capsulePayload = pickModelFields(Capsule, {
      creator_id: req.user.id,
      title,
      description,
      capsule_type,
      open_at: open_at ? new Date(open_at) : null,
      visibility_duration: visibility_duration != null ? Number(visibility_duration) : null,
      required_contributors: required_contributors != null ? Number(required_contributors) : null,
      status: "locked",
    });

    const created = await Capsule.create(capsulePayload);

    // ✅ Pentru KEY capsule:
    // 1) salvăm cheia (hash) în capsule_key (tabel existent)
    // 2) salvăm POZA în CapsuleContribution (tabel existent) ca “secret media”
    if (capsule_type === "key") {
      const expiresAt = key_expires_at ? new Date(key_expires_at) : null;

      // Service-ul tău trebuie să salveze HASH în CapsuleKey.value.
      await createKeyForCapsule(created.capsule_id, {
        expiresAt,
        plainKey: String(key_plain),
      });

      // ✅ Salvează poza într-o contribuție (sigur există coloana media_url acolo)
      // o marcăm ca “secret” prin faptul că e prima contribuție și e făcută de owner
      await CapsuleContribution.create({
        capsule_id: created.capsule_id,
        user_id: req.user.id,
        content_text: null,
        media_url: String(media_url),
      });

      return res.status(201).json({
        ...created.toJSON(),
        qr_payload: qrPayloadForCapsule(req, created.capsule_id),
        key_expires_at: expiresAt || null,
      });
    }

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// LIST my capsules
// ─────────────────────────────────────────────
router.get("/my", auth, async (req, res, next) => {
  try {
    const list = await Capsule.findAll({
      where: { creator_id: req.user.id },
      order: [["created_at", "DESC"]],
    });

    for (const c of list) await refreshCapsuleStatus(c);

    const ids = list.map((x) => x.capsule_id);
    const keys = await CapsuleKey.findAll({
      where: { capsule_id: ids },
      attributes: ["capsule_id", "expires_at"],
      raw: true,
    });
    const keyMap = new Map(keys.map((k) => [k.capsule_id, k]));

    const enriched = list.map((c) => {
      const row = c.toJSON();
      const keyRow = keyMap.get(c.capsule_id);

      return {
        ...row,
        qr_payload: row.capsule_type === "key" ? qrPayloadForCapsule(req, row.capsule_id) : null,
        key_expires_at: keyRow?.expires_at || null,
        has_key: !!keyRow,
      };
    });

    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// LIST all capsules (feed helper)
// ─────────────────────────────────────────────
router.get("/", auth, async (req, res, next) => {
  try {
    const list = await Capsule.findAll({
      order: [["created_at", "DESC"]],
      limit: 100,
    });

    for (const c of list) await refreshCapsuleStatus(c);

    const ids = list.map((x) => x.capsule_id);
    const keys = await CapsuleKey.findAll({
      where: { capsule_id: ids },
      attributes: ["capsule_id", "expires_at"],
      raw: true,
    });
    const keyMap = new Map(keys.map((k) => [k.capsule_id, k]));

    const enriched = list.map((c) => {
      const row = c.toJSON();
      const keyRow = keyMap.get(c.capsule_id);

      return {
        ...row,
        qr_payload: row.capsule_type === "key" ? qrPayloadForCapsule(req, row.capsule_id) : null,
        key_expires_at: keyRow?.expires_at || null,
        has_key: !!keyRow,
      };
    });

    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// GET capsule details (+ contributions if allowed)
// ─────────────────────────────────────────────
router.get("/:id", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    const allowed = await canUserViewCapsule(capsule, req.user.id);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    const canSeeContent = capsule.status === "open" || capsule.creator_id === req.user.id;

    let contributions = [];
    if (canSeeContent) {
      contributions = await CapsuleContribution.findAll({
        where: { capsule_id: capsule.capsule_id },
        include: [{ model: User, attributes: ["id", "username", "email"] }],
        order: [["created_at", "ASC"]],
      });
    }

    let uniqueContributors = null;
    if (capsule.capsule_type === "co") {
      uniqueContributors = await getUniqueContributorsCount(capsule.capsule_id);
    }

    let keyMeta = null;
    if (capsule.capsule_type === "key") {
      const k = await CapsuleKey.findOne({
        where: { capsule_id: capsule.capsule_id },
        attributes: ["capsule_id", "expires_at"],
        raw: true,
      });
      keyMeta = {
        has_key: !!k,
        key_expires_at: k?.expires_at || null,
        qr_payload: qrPayloadForCapsule(req, capsule.capsule_id),
      };
    }

    res.json({
      capsule,
      contributions,
      uniqueContributors,
      key: keyMeta,
    });
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// UNLOCK key capsule (introduci cheia → primești poza)
// POST /capsules/:id/unlock { key: "..." }
// ─────────────────────────────────────────────
router.post("/:id/unlock", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    if (capsule.capsule_type !== "key") {
      return res.status(409).json({ error: "unlock is only for key capsules" });
    }

    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: "key is required" });

    // bcrypt compare + create CapsuleAccess
    const result = await joinWithKey(capsule.capsule_id, req.user.id, String(key));
    if (!result.ok) return res.status(401).json({ error: "Invalid or expired key" });

    // ✅ Poza secretă e în CapsuleContribution (prima contribuție cu media)
    const secret = await CapsuleContribution.findOne({
      where: { capsule_id: capsule.capsule_id },
      // ia prima contribuție care are media_url
      order: [["created_at", "ASC"]],
    });

    const media = secret?.media_url || null;

    return res.json({ ok: true, media_url: media });
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// ADD contribution
// ─────────────────────────────────────────────
router.post("/:id/contributions", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    if (capsule.status === "archived") {
      return res.status(409).json({ error: "Capsule is archived" });
    }

    const allowed = await canUserViewCapsule(capsule, req.user.id);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    const { content_text = null, media_url = null } = req.body || {};
    if (!content_text && !media_url) {
      return res.status(400).json({ error: "content_text or media_url required" });
    }

    const created = await CapsuleContribution.create({
      capsule_id: capsule.capsule_id,
      user_id: req.user.id,
      content_text,
      media_url,
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// TRY OPEN capsule
// ─────────────────────────────────────────────
router.post("/:id/open", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    const allowed = await canUserViewCapsule(capsule, req.user.id);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    const result = await attemptOpenCapsule(capsule);

    if (!result.ok) {
      return res.status(409).json({
        error: "Cannot open capsule yet",
        reason: result.reason,
        extra: result.cnt,
      });
    }

    res.json(result.capsule);
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// GENERATE KEY / JOIN WITH KEY (păstrăm)
// ─────────────────────────────────────────────
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

    const { expires_at = null, key_plain = null } = req.body || {};

    const keyObj = await createKeyForCapsule(capsule.capsule_id, {
      expiresAt: expires_at,
      plainKey: key_plain ? String(key_plain) : null,
    });

    res.status(201).json({
      key: keyObj.value,
      expires_at: keyObj.expires_at || null,
      qr_payload: qrPayloadForCapsule(req, capsule.capsule_id),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/join-with-key", auth, async (req, res, next) => {
  try {
    const capsule = await Capsule.findByPk(req.params.id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    if (capsule.capsule_type !== "key") {
      return res.status(409).json({ error: "join-with-key is only for key capsules" });
    }

    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: "key is required" });

    const result = await joinWithKey(capsule.capsule_id, req.user.id, String(key));
    if (!result.ok) return res.status(403).json({ error: "Invalid or expired key" });

    res.json({ message: "Access granted" });
  } catch (e) {
    next(e);
  }
});

module.exports = router;