const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Op, fn, col } = require("sequelize");

const Capsule = require("../models/Capsule");
const CapsuleContribution = require("../models/CapsuleContribution");
const CapsuleKey = require("../models/CapsuleKey");
const CapsuleAccess = require("../models/CapsuleAccess");

/* ───────────────────── helpers ───────────────────── */

function nowDate() {
  return new Date();
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function generatePlainKey() {
  return crypto.randomBytes(16).toString("hex"); // 32 chars
}

/* ───────────────────── STATUS ───────────────────── */

async function refreshCapsuleStatus(capsule) {
  if (!capsule) return null;

  // auto-open
  if (capsule.status === "locked") {
    const check = await canOpenCapsule(capsule);
    if (check.ok) {
      capsule.status = "open";
      capsule.opened_at = nowDate();
      await capsule.save();
    }
  }

  // auto-archive
  if (
    capsule.status === "open" &&
    capsule.opened_at &&
    capsule.visibility_duration != null
  ) {
    const expiresAt = addHours(capsule.opened_at, capsule.visibility_duration);
    if (nowDate() > expiresAt) {
      capsule.status = "archived";
      capsule.archived_at = nowDate();
      await capsule.save();
    }
  }

  return capsule;
}

/* ───────────────────── CO CAPS ───────────────────── */

async function getUniqueContributorsCount(capsuleId) {
  const row = await CapsuleContribution.findOne({
    where: { capsule_id: capsuleId },
    attributes: [[fn("COUNT", fn("DISTINCT", col("user_id"))), "cnt"]],
    raw: true,
  });

  return Number(row?.cnt || 0);
}

/* ───────────────────── ACCESS ───────────────────── */

async function userHasKeyAccess(capsuleId, userId) {
  const hit = await CapsuleAccess.findOne({
    where: { capsule_id: capsuleId, user_id: userId },
  });
  return !!hit;
}

async function canUserViewCapsule(capsule, userId) {
  if (!capsule) return false;
  if (capsule.creator_id === userId) return true;

  if (capsule.capsule_type === "key") {
    return await userHasKeyAccess(capsule.capsule_id, userId);
  }

  return true;
}

/* ───────────────────── OPEN LOGIC ───────────────────── */

async function canOpenCapsule(capsule) {
  if (!capsule) return { ok: false, reason: "not_found" };
  if (capsule.status === "archived") return { ok: false, reason: "archived" };
  if (capsule.status === "open") return { ok: true };

  const now = nowDate();

  if (capsule.capsule_type === "time") {
    if (!capsule.open_at) return { ok: false };
    if (now < new Date(capsule.open_at)) return { ok: false };
    return { ok: true };
  }

  if (capsule.capsule_type === "co") {
    const cnt = await getUniqueContributorsCount(capsule.capsule_id);
    if (cnt < capsule.required_contributors) {
      return { ok: false, cnt };
    }
    return { ok: true, cnt };
  }

  if (capsule.capsule_type === "key") {
    const keyCount = await CapsuleKey.count({
      where: { capsule_id: capsule.capsule_id },
    });
    if (keyCount <= 0) return { ok: false };
    return { ok: true };
  }

  return { ok: false };
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

/* ───────────────────── KEY CAPS ───────────────────── */

/**
 * Creează / regenerează cheia
 * ✔ hash bcrypt
 * ✔ 1 key / capsulă
 * ✔ NU salvează QR în DB
 */
async function createKeyForCapsule(capsuleId, { expiresAt = null, plainKey = null } = {}) {
  const keyPlain = plainKey || generatePlainKey();
  const hash = await bcrypt.hash(keyPlain, 10);

  const expires_at = expiresAt ? new Date(expiresAt) : null;

  const existing = await CapsuleKey.findOne({
    where: { capsule_id: capsuleId },
  });

  if (existing) {
    await existing.update({ value: hash, expires_at });
  } else {
    await CapsuleKey.create({
      capsule_id: capsuleId,
      value: hash,
      expires_at,
    });
  }

  // ⚠ cheia în clar se returnează DOAR acum
  return { value: keyPlain, expires_at };
}

/**
 * Acces cu cheie
 * ✔ bcrypt compare
 * ✔ creează CapsuleAccess
 */
async function joinWithKey(capsuleId, userId, keyValue) {
  const keyRow = await CapsuleKey.findOne({
    where: { capsule_id: capsuleId },
  });

  if (!keyRow) return { ok: false };

  if (
    keyRow.expires_at &&
    new Date(keyRow.expires_at).getTime() < Date.now()
  ) {
    return { ok: false };
  }

  const ok = await bcrypt.compare(String(keyValue), String(keyRow.value));
  if (!ok) return { ok: false };

  await CapsuleAccess.findOrCreate({
    where: { capsule_id: capsuleId, user_id: userId },
    defaults: { capsule_id: capsuleId, user_id: userId },
  });

  return { ok: true };
}

/* ───────────────────── EXPORTS ───────────────────── */

module.exports = {
  refreshCapsuleStatus,
  getUniqueContributorsCount,
  canUserViewCapsule,
  canOpenCapsule,
  attemptOpenCapsule,
  createKeyForCapsule,
  joinWithKey,
};