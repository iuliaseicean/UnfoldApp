const crypto = require("crypto");
const { Op, fn, col } = require("sequelize");
const Capsule = require("../models/Capsule");
const CapsuleContribution = require("../models/CapsuleContribution");
const CapsuleKey = require("../models/CapsuleKey");
const CapsuleAccess = require("../models/CapsuleAccess");

function nowDate() {
  return new Date();
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

async function refreshCapsuleStatus(capsule) {
  if (!capsule) return null;

  // dacă e OPEN și a expirat visibility window -> ARCHIVED
  if (capsule.status === "open" && capsule.opened_at && capsule.visibility_duration != null) {
    const expiresAt = addHours(capsule.opened_at, capsule.visibility_duration);
    if (nowDate() > expiresAt) {
      capsule.status = "archived";
      capsule.archived_at = nowDate();
      await capsule.save();
    }
  }

  return capsule;
}

async function getUniqueContributorsCount(capsuleId) {
  const row = await CapsuleContribution.findOne({
    where: { capsule_id: capsuleId },
    attributes: [[fn("COUNT", fn("DISTINCT", col("author_id"))), "cnt"]],
    raw: true
  });

  return Number(row?.cnt || 0);
}

async function userHasKeyAccess(capsuleId, userId) {
  const hit = await CapsuleAccess.findOne({ where: { capsule_id: capsuleId, user_id: userId } });
  return !!hit;
}

async function canUserViewCapsule(capsule, userId) {
  if (!capsule) return false;
  if (capsule.creator_id === userId) return true;

  if (capsule.capsule_type === "key") {
    return await userHasKeyAccess(capsule.capsule_id, userId);
  }

  // time/co: vizibile pentru useri autentificați (poți restrânge dacă vreți)
  return true;
}

async function canOpenCapsule(capsule) {
  if (!capsule) return { ok: false, reason: "not_found" };
  if (capsule.status === "archived") return { ok: false, reason: "archived" };
  if (capsule.status === "open") return { ok: true };

  const now = nowDate();

  if (capsule.capsule_type === "time") {
    if (!capsule.open_at) return { ok: false, reason: "missing_open_at" };
    if (now < new Date(capsule.open_at)) return { ok: false, reason: "too_early" };
    return { ok: true };
  }

  if (capsule.capsule_type === "co") {
    if (!capsule.required_contributors || capsule.required_contributors < 2) {
      return { ok: false, reason: "missing_required_contributors" };
    }
    const cnt = await getUniqueContributorsCount(capsule.capsule_id);
    if (cnt < capsule.required_contributors) return { ok: false, reason: "not_enough_contributors", cnt };
    return { ok: true, cnt };
  }

  if (capsule.capsule_type === "key") {
    // cheile sunt pentru acces, dar deschiderea poate fi permisă și aici.
    // Regula minimă: trebuie să existe cel puțin o cheie creată.
    const keyCount = await CapsuleKey.count({ where: { capsule_id: capsule.capsule_id } });
    if (keyCount <= 0) return { ok: false, reason: "no_key_generated" };
    return { ok: true };
  }

  return { ok: false, reason: "unknown_type" };
}

async function attemptOpenCapsule(capsule) {
  const check = await canOpenCapsule(capsule);
  if (!check.ok) return check;

  if (capsule.status !== "open") {
    capsule.status = "open";
    capsule.opened_at = nowDate();
    await capsule.save();
  }

  return { ok: true, capsule };
}

async function createKeyForCapsule(capsuleId, { expiresAt = null } = {}) {
  const value = crypto.randomBytes(16).toString("hex");

  const created = await CapsuleKey.create({
    capsule_id: capsuleId,
    value,
    expires_at: expiresAt ? new Date(expiresAt) : null
  });

  return created;
}

async function joinWithKey(capsuleId, userId, keyValue) {
  const key = await CapsuleKey.findOne({
    where: {
      capsule_id: capsuleId,
      value: keyValue,
      [Op.or]: [
        { expires_at: null },
        { expires_at: { [Op.gt]: nowDate() } }
      ]
    }
  });

  if (!key) return { ok: false, reason: "invalid_or_expired_key" };

  await CapsuleAccess.findOrCreate({
    where: { capsule_id: capsuleId, user_id: userId },
    defaults: { capsule_id: capsuleId, user_id: userId }
  });

  return { ok: true };
}

module.exports = {
  refreshCapsuleStatus,
  getUniqueContributorsCount,
  canUserViewCapsule,
  canOpenCapsule,
  attemptOpenCapsule,
  createKeyForCapsule,
  joinWithKey
};
