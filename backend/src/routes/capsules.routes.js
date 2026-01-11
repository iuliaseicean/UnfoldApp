// backend/src/routes/capsules.routes.js
require("dotenv").config();
const router = require("express").Router();
const auth = require("../middlewares/auth");
const { Op } = require("sequelize");

const Capsule = require("../models/Capsule");
const User = require("../models/User");
const CapsuleContribution = require("../models/CapsuleContribution");
const CapsuleKey = require("../models/CapsuleKey");

const { sequelize } = require("../config/db");

const {
  refreshCapsuleStatus,
  canUserViewCapsule,
  attemptOpenCapsule,
  createKeyForCapsule,
  joinWithKey,
  getUniqueContributorsCount,
} = require("../services/capsule.service");

// ✅ Varianta A: tabelă separată pt privacy
let UserSettings = null;
try {
  UserSettings = require("../models/UserSettings");
} catch {
  UserSettings = null;
}

/**
 * Helpers
 */
function hasAttr(model, name) {
  return !!model?.rawAttributes?.[name];
}

function getAuthUserId(req) {
  return req.user?.id ?? req.user?.user_id ?? null;
}

function toId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * PK pentru Capsule (capsule_id / id)
 */
function getCapsulePkField() {
  if (hasAttr(Capsule, "capsule_id")) return "capsule_id";
  if (hasAttr(Capsule, "id")) return "id";
  return Capsule.primaryKeyAttribute || "id";
}

/**
 * Owner field pentru Capsule (creator_id / creatorId)
 */
function getCapsuleOwnerField() {
  if (hasAttr(Capsule, "creator_id")) return "creator_id";
  if (hasAttr(Capsule, "creatorId")) return "creatorId";
  return "creator_id";
}

/**
 * APP_URL pentru payload QR (NU îl salvăm în DB)
 */
function getAppUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL;

  const host = req.get("host");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  return `${proto}://${host}`;
}

function qrPayloadForCapsule(req, capsuleId) {
  return `${getAppUrl(req)}/capsule/key/${capsuleId}`;
}

/**
 * Filtrăm payload-ul doar pe coloanele existente în model
 */
function pickModelFields(model, data) {
  const allowed = new Set(Object.keys(model?.rawAttributes || {}));
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

/**
 * Alege automat un câmp de sortare existent: created_at / createdAt / PK
 */
function getOrderField(model) {
  const attrs = model?.rawAttributes || {};
  if (attrs.created_at) return "created_at";
  if (attrs.createdAt) return "createdAt";
  return model?.primaryKeyAttribute || "id";
}

function orderByCreated(model, dir = "DESC") {
  return [[getOrderField(model), dir]];
}

/**
 * Safe user attrs (fără parolă)
 */
function getSafeUserAttrs() {
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

/* ───────────────────── Privacy (Varianta A) ───────────────────── */

/**
 * Returnează setul de user_id care sunt private (is_private=true)
 */
async function getPrivateUserIdSet(userIds) {
  const ids = (Array.isArray(userIds) ? userIds : [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);

  if (!ids.length) return new Set();
  if (!UserSettings) return new Set(); // fallback: tot public

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
 * Filtru privacy pentru capsule:
 * - capsule ale userilor publici -> ok
 * - capsule ale userilor private -> doar owner le vede
 */
async function applyPrivacyFilterToCapsules(req, capsules) {
  const meId = Number(getAuthUserId(req) || 0);
  if (!meId) return [];

  const ownerField = getCapsuleOwnerField();
  const arr = Array.isArray(capsules) ? capsules : [];

  const ownerIds = arr
    .map((c) => {
      const row = typeof c?.toJSON === "function" ? c.toJSON() : c;
      return Number(
        row?.[ownerField] ??
          (typeof c?.get === "function" ? c.get(ownerField) : c?.[ownerField])
      );
    })
    .filter((x) => Number.isFinite(x) && x > 0);

  const privateSet = await getPrivateUserIdSet(ownerIds);

  return arr.filter((c) => {
    const row = typeof c?.toJSON === "function" ? c.toJSON() : c;
    const ownerId = Number(
      row?.[ownerField] ??
        (typeof c?.get === "function" ? c.get(ownerField) : c?.[ownerField])
    );

    if (!ownerId) return false;

    // public
    if (!privateSet.has(ownerId)) return true;

    // private -> only owner
    return ownerId === meId;
  });
}

/**
 * Guard privacy pentru o singură capsulă
 */
async function canViewCapsuleByPrivacy(req, capsule) {
  const meId = Number(getAuthUserId(req) || 0);
  if (!meId) return false;

  const ownerField = getCapsuleOwnerField();
  const row = typeof capsule?.toJSON === "function" ? capsule.toJSON() : capsule;
  const ownerId = Number(
    row?.[ownerField] ??
      (typeof capsule?.get === "function" ? capsule.get(ownerField) : capsule?.[ownerField])
  );

  if (!ownerId) return false;
  if (!UserSettings) return true; // fallback: public

  try {
    const settings = await UserSettings.findOne({
      where: { user_id: ownerId },
      attributes: ["is_private"],
      raw: true,
    });

    const isPrivate = !!settings?.is_private;
    if (!isPrivate) return true;
    return ownerId === meId;
  } catch {
    // dacă tabela lipsește/eroare, nu blocăm
    return true;
  }
}

/* ───────────────────── enrich meta ───────────────────── */

/**
 * Enrich pentru key meta (qr/exp/has_key)
 */
async function enrichWithKeyMeta(req, capsules) {
  const arr = Array.isArray(capsules) ? capsules : [];
  const ids = arr
    .map((c) => {
      const row = typeof c?.toJSON === "function" ? c.toJSON() : c;
      return row?.capsule_id ?? row?.id;
    })
    .filter(Boolean);

  const keys = ids.length
    ? await CapsuleKey.findAll({
        where: { capsule_id: ids },
        attributes: ["capsule_id", "expires_at"],
        raw: true,
      })
    : [];

  const keyMap = new Map(keys.map((k) => [Number(k.capsule_id), k]));

  return arr.map((c) => {
    const row = typeof c?.toJSON === "function" ? c.toJSON() : c;
    const cid = Number(row.capsule_id ?? row.id);
    const keyRow = keyMap.get(cid);

    return {
      ...row,
      qr_payload: row.capsule_type === "key" ? qrPayloadForCapsule(req, cid) : null,
      key_expires_at: keyRow?.expires_at || null,
      has_key: !!keyRow,
    };
  });
}

/**
 * Enrich pentru CO meta:
 * - contributorsCount (unique users)
 * - isFull
 * - canContribute
 */
async function enrichWithCoMeta(capsules, userId) {
  const arr = Array.isArray(capsules) ? capsules : [];
  const coCaps = arr.filter((c) => {
    const row = typeof c?.toJSON === "function" ? c.toJSON() : c;
    return row?.capsule_type === "co";
  });

  if (!coCaps.length) {
    return arr.map((c) => ({
      ...(typeof c?.toJSON === "function" ? c.toJSON() : c),
      contributorsCount: null,
      isFull: null,
      canContribute: null,
    }));
  }

  const coIds = coCaps
    .map((c) => {
      const row = typeof c?.toJSON === "function" ? c.toJSON() : c;
      return Number(row.capsule_id ?? row.id);
    })
    .filter(Boolean);

  // contributorsCount
  const counts = new Map();
  for (const id of coIds) {
    const cnt = await getUniqueContributorsCount(id);
    counts.set(id, Number(cnt || 0));
  }

  // userAlreadyContributed
  let contributedSet = new Set();
  if (userId && coIds.length) {
    const rows = await CapsuleContribution.findAll({
      where: { capsule_id: coIds, user_id: userId },
      attributes: ["capsule_id"],
      raw: true,
    });
    contributedSet = new Set(rows.map((r) => Number(r.capsule_id)));
  }

  return arr.map((c) => {
    const row = typeof c?.toJSON === "function" ? c.toJSON() : c;

    if (row.capsule_type !== "co") {
      return { ...row, contributorsCount: null, isFull: null, canContribute: null };
    }

    const cid = Number(row.capsule_id ?? row.id);
    const required = Number(row.required_contributors || 0);
    const cnt = Number(counts.get(cid) || 0);

    const isFull = required > 0 ? cnt >= required : false;
    const already = contributedSet.has(cid);

    const canContribute =
      !already && !isFull && row.status !== "archived" && row.status !== "open";

    return {
      ...row,
      contributorsCount: cnt,
      isFull,
      canContribute,
    };
  });
}

/**
 * Enrich pentru "canDelete" (doar creatorul capsulei)
 */
function enrichWithCanDelete(capsules, userId) {
  const arr = Array.isArray(capsules) ? capsules : [];
  const ownerField = getCapsuleOwnerField();

  return arr.map((c) => {
    const row = typeof c?.toJSON === "function" ? c.toJSON() : c;
    const ownerId = Number(row?.[ownerField]);
    return {
      ...row,
      canDelete: !!userId && ownerId === Number(userId),
    };
  });
}

/**
 * Helper: refresh + access filter (service) + privacy filter + enrich
 */
async function prepareListForUser(req, list, userId) {
  // refresh status
  for (const c of list) await refreshCapsuleStatus(c);

  // service-level access
  const allowedByRules = [];
  for (const c of list) {
    const ok = await canUserViewCapsule(c, userId);
    if (ok) allowedByRules.push(c);
  }

  // ✅ privacy filter (UserSettings)
  const allowedByPrivacy = await applyPrivacyFilterToCapsules(req, allowedByRules);

  // enrich meta
  const withKey = await enrichWithKeyMeta(req, allowedByPrivacy);
  const withCo = await enrichWithCoMeta(withKey, userId);
  const withDelete = enrichWithCanDelete(withCo, userId);
  return withDelete;
}

// ─────────────────────────────────────────────
// IMPORTANT: rutele "statice" (/search, /my) înainte de "/:id"
// ─────────────────────────────────────────────

// SEARCH capsules
// GET /capsules/search?q=...
router.get("/search", auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const attrs = Capsule?.rawAttributes || {};
    const whereOr = [];
    if (attrs.title) whereOr.push({ title: { [Op.like]: `%${q}%` } });
    if (attrs.description) whereOr.push({ description: { [Op.like]: `%${q}%` } });

    if (!whereOr.length) return res.json([]);

    // fetch more then filter, ca să nu rămâi cu prea puține după privacy
    const list = await Capsule.findAll({
      where: { [Op.or]: whereOr },
      order: orderByCreated(Capsule, "DESC"),
      limit: 200,
    });

    const enriched = await prepareListForUser(req, list, userId);
    return res.json(enriched.slice(0, 50));
  } catch (e) {
    next(e);
  }
});

// CREATE capsule (TIME/CO/KEY)
// POST /capsules
router.post("/", auth, async (req, res, next) => {
  try {
    const {
      title = null,
      description = null,
      capsule_type = "time",
      open_at = null,
      visibility_duration = null,
      required_contributors = null,

      cover_url = null,
      media_url = null,

      key_plain = null,
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

    if (capsule_type === "key") {
      if (!key_plain || !String(key_plain).trim()) {
        return res.status(400).json({ error: "key_plain is required for key capsules" });
      }
      if (!media_url || !String(media_url).trim()) {
        return res.status(400).json({ error: "media_url (image url) is required for key capsules" });
      }
    }

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const capsulePayload = pickModelFields(Capsule, {
      creator_id: userId,
      creatorId: userId,
      title,
      description,
      capsule_type,
      open_at: open_at ? new Date(open_at) : null,
      visibility_duration: visibility_duration != null ? Number(visibility_duration) : null,
      required_contributors: required_contributors != null ? Number(required_contributors) : null,
      status: "locked",

      cover_url: cover_url || media_url || null,
      media_url: media_url || cover_url || null,
    });

    const created = await Capsule.create(capsulePayload);

    // CO: creatorul devine primul contributor
    if (capsule_type === "co") {
      const firstMedia = String(media_url || cover_url || "").trim() || null;
      if (firstMedia) {
        await CapsuleContribution.create({
          capsule_id: created.capsule_id ?? created.id,
          user_id: userId,
          content_text: null,
          media_url: firstMedia,
        });
      }
    }

    if (capsule_type === "key") {
      const expiresAt = key_expires_at ? new Date(key_expires_at) : null;

      await createKeyForCapsule(created.capsule_id, {
        expiresAt,
        plainKey: String(key_plain),
      });

      await CapsuleContribution.create({
        capsule_id: created.capsule_id,
        user_id: userId,
        content_text: null,
        media_url: String(media_url),
      });

      return res.status(201).json({
        ...created.toJSON(),
        qr_payload: qrPayloadForCapsule(req, created.capsule_id),
        key_expires_at: expiresAt || null,
        has_key: true,
        canDelete: true,
      });
    }

    if (capsule_type === "co") {
      const enriched = await enrichWithCoMeta([created], userId);
      const withDelete = enrichWithCanDelete(enriched, userId);
      return res.status(201).json(withDelete[0]);
    }

    return res.status(201).json({ ...created.toJSON(), canDelete: true });
  } catch (e) {
    next(e);
  }
});

// LIST my capsules
// GET /capsules/my
router.get("/my", auth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const list = await Capsule.findAll({
      where: { creator_id: userId },
      order: orderByCreated(Capsule, "DESC"),
    });

    // my -> nu are sens privacy filter (oricum sunt ale mele), dar păstrăm flow consistent
    const enriched = await prepareListForUser(req, list, userId);
    return res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// LIST all capsules (feed helper)
// GET /capsules
router.get("/", auth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);

    // fetch mai mult ca să compensăm filtrarea privacy
    const fetchLimit = Math.min(limit * 3, 600);

    const list = await Capsule.findAll({
      order: orderByCreated(Capsule, "DESC"),
      limit: fetchLimit,
    });

    const enriched = await prepareListForUser(req, list, userId);
    return res.json(enriched.slice(0, limit));
  } catch (e) {
    next(e);
  }
});

// ✅ DELETE capsule (doar creatorul)
// DELETE /capsules/:id
router.delete("/:id", auth, async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const id = toId(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ error: "Invalid capsule id" });
    }

    const userId = getAuthUserId(req);
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ error: "Unauthorized" });
    }

    const capsule = await Capsule.findByPk(id, { transaction: t });
    if (!capsule) {
      await t.rollback();
      return res.status(404).json({ error: "Capsule not found" });
    }

    const ownerField = getCapsuleOwnerField();
    const ownerId = Number(capsule?.get?.(ownerField) ?? capsule?.[ownerField]);

    if (ownerId !== Number(userId)) {
      await t.rollback();
      return res.status(403).json({ error: "You can delete only your capsules" });
    }

    const cid = Number(
      capsule?.get?.(getCapsulePkField()) ?? capsule?.[getCapsulePkField()] ?? id
    );

    await CapsuleContribution.destroy({ where: { capsule_id: cid }, transaction: t });
    await CapsuleKey.destroy({ where: { capsule_id: cid }, transaction: t });

    const pk = getCapsulePkField();
    await Capsule.destroy({ where: { [pk]: cid }, transaction: t });

    await t.commit();
    return res.json({ ok: true });
  } catch (e) {
    await t.rollback();
    next(e);
  }
});

// GET capsule details (+ contributions if allowed)
// GET /capsules/:id
router.get("/:id", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid capsule id" });

    const capsule = await Capsule.findByPk(id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✅ privacy guard
    const okPrivacy = await canViewCapsuleByPrivacy(req, capsule);
    if (!okPrivacy) return res.status(403).json({ error: "This profile is private" });

    const allowed = await canUserViewCapsule(capsule, userId);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    // ✅ Co-Caps: contributions vizibile și când e locked
    const canSeeContent =
      capsule.status === "open" || capsule.creator_id === userId || capsule.capsule_type === "co";

    let contributions = [];
    if (canSeeContent) {
      contributions = await CapsuleContribution.findAll({
        where: { capsule_id: capsule.capsule_id },
        include: [{ model: User, attributes: getSafeUserAttrs(), required: false }],
        order: orderByCreated(CapsuleContribution, "ASC"),
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

    let coMeta = null;
    if (capsule.capsule_type === "co") {
      const enriched = await enrichWithCoMeta([capsule], userId);
      const row = enriched[0];
      coMeta = {
        contributorsCount: row.contributorsCount ?? 0,
        isFull: !!row.isFull,
        canContribute: !!row.canContribute,
        required_contributors: capsule.required_contributors ?? null,
      };
    }

    const ownerField = getCapsuleOwnerField();
    const ownerId = Number(capsule?.get?.(ownerField) ?? capsule?.[ownerField]);
    const canDelete = ownerId === Number(userId);

    return res.json({
      capsule: { ...(typeof capsule?.toJSON === "function" ? capsule.toJSON() : capsule), canDelete },
      contributions,
      uniqueContributors,
      key: keyMeta,
      co: coMeta,
    });
  } catch (e) {
    next(e);
  }
});

// UNLOCK key capsule
// POST /capsules/:id/unlock { key: "..." }
router.post("/:id/unlock", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid capsule id" });

    const capsule = await Capsule.findByPk(id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    if (capsule.capsule_type !== "key") {
      return res.status(409).json({ error: "unlock is only for key capsules" });
    }

    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: "key is required" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✅ privacy guard (înainte de join)
    const okPrivacy = await canViewCapsuleByPrivacy(req, capsule);
    if (!okPrivacy) return res.status(403).json({ error: "This profile is private" });

    const result = await joinWithKey(capsule.capsule_id, userId, String(key));
    if (!result.ok) return res.status(401).json({ error: "Invalid or expired key" });

    const secret = await CapsuleContribution.findOne({
      where: {
        capsule_id: capsule.capsule_id,
        media_url: { [Op.ne]: null },
      },
      order: orderByCreated(CapsuleContribution, "ASC"),
    });

    return res.json({ ok: true, media_url: secret?.media_url || null });
  } catch (e) {
    next(e);
  }
});

// ADD contribution
// POST /capsules/:id/contributions
router.post("/:id/contributions", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid capsule id" });

    const capsule = await Capsule.findByPk(id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    if (capsule.status === "archived") {
      return res.status(409).json({ error: "Capsule is archived" });
    }

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✅ privacy guard
    const okPrivacy = await canViewCapsuleByPrivacy(req, capsule);
    if (!okPrivacy) return res.status(403).json({ error: "This profile is private" });

    const allowed = await canUserViewCapsule(capsule, userId);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    // CO rules
    if (capsule.capsule_type === "co") {
      const required = Number(capsule.required_contributors || 0);
      const cnt = await getUniqueContributorsCount(capsule.capsule_id);
      if (required > 0 && Number(cnt || 0) >= required) {
        return res.status(409).json({ error: "Co-Caps is already full" });
      }

      const existing = await CapsuleContribution.findOne({
        where: { capsule_id: capsule.capsule_id, user_id: userId },
      });
      if (existing) {
        return res.status(409).json({ error: "You already contributed to this Co-Caps" });
      }
    }

    const { content_text = null, media_url = null } = req.body || {};
    if (!content_text && !media_url) {
      return res.status(400).json({ error: "content_text or media_url required" });
    }

    const created = await CapsuleContribution.create({
      capsule_id: capsule.capsule_id,
      user_id: userId,
      content_text,
      media_url,
    });

    return res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// TRY OPEN capsule
// POST /capsules/:id/open
router.post("/:id/open", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid capsule id" });

    const capsule = await Capsule.findByPk(id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    await refreshCapsuleStatus(capsule);

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✅ privacy guard
    const okPrivacy = await canViewCapsuleByPrivacy(req, capsule);
    if (!okPrivacy) return res.status(403).json({ error: "This profile is private" });

    const allowed = await canUserViewCapsule(capsule, userId);
    if (!allowed) return res.status(403).json({ error: "No access to this capsule" });

    const result = await attemptOpenCapsule(capsule);

    if (!result.ok) {
      return res.status(409).json({
        error: "Cannot open capsule yet",
        reason: result.reason,
        extra: result.cnt,
      });
    }

    return res.json(result.capsule);
  } catch (e) {
    next(e);
  }
});

// GENERATE KEY (owner)
// POST /capsules/:id/generate-key
router.post("/:id/generate-key", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid capsule id" });

    const capsule = await Capsule.findByPk(id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (capsule.creator_id !== userId) {
      return res.status(403).json({ error: "Only owner can generate keys" });
    }

    if (capsule.capsule_type !== "key") {
      return res.status(409).json({ error: "generate-key is only for key capsules" });
    }

    const { expires_at = null, key_plain = null } = req.body || {};

    const keyObj = await createKeyForCapsule(capsule.capsule_id, {
      expiresAt: expires_at ? new Date(expires_at) : null,
      plainKey: key_plain ? String(key_plain) : null,
    });

    return res.status(201).json({
      key: keyObj.value,
      expires_at: keyObj.expires_at || null,
      qr_payload: qrPayloadForCapsule(req, capsule.capsule_id),
    });
  } catch (e) {
    next(e);
  }
});

// JOIN WITH KEY
// POST /capsules/:id/join-with-key
router.post("/:id/join-with-key", auth, async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid capsule id" });

    const capsule = await Capsule.findByPk(id);
    if (!capsule) return res.status(404).json({ error: "Capsule not found" });

    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✅ privacy guard
    const okPrivacy = await canViewCapsuleByPrivacy(req, capsule);
    if (!okPrivacy) return res.status(403).json({ error: "This profile is private" });

    if (capsule.capsule_type !== "key") {
      return res.status(409).json({ error: "join-with-key is only for key capsules" });
    }

    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: "key is required" });

    const result = await joinWithKey(capsule.capsule_id, userId, String(key));
    if (!result.ok) return res.status(403).json({ error: "Invalid or expired key" });

    return res.json({ message: "Access granted" });
  } catch (e) {
    next(e);
  }
});

module.exports = router;