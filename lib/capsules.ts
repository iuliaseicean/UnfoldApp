// lib/capsules.ts
import api from "@/lib/api";
import type { Capsule } from "@/types/capsule";

/**
 * ✅ Meta CO-caps (pentru UX: progres + buton "+")
 */
export type CoCapsMeta = {
  contributorsCount?: number | null; // câți contribuitori unici (distinct)
  required_contributors?: number | null; // target
  isFull?: boolean | null; // contributorsCount >= required_contributors
  canContribute?: boolean | null; // user-ul curent poate contribui
};

/**
 * ✅ Extra fields pe care le atașăm pe capsule pentru feed
 * (indiferent dacă backend le trimite în "co" sau direct pe capsule)
 */
export type CoCapsMetaFields = {
  contributorsCount?: number | null;
  isFull?: boolean | null;
  canContribute?: boolean | null;
  required_contributors?: number | null;
};

export type CapsuleContribution = {
  id?: number;
  capsule_id: number;
  user_id: number;
  content_text: string | null;
  media_url: string | null;
  created_at?: string;
  User?: {
    id?: number;
    user_id?: number;
    username?: string;
    email?: string;
    name?: string;
    avatar_url?: string | null;
  };
};

export type CapsuleKeyMeta = {
  has_key?: boolean;
  key_expires_at?: string | null;
  qr_payload?: string | null;
};

export type CapsuleDetailsResponse = {
  capsule: Capsule & CoCapsMetaFields;
  contributions: CapsuleContribution[];
  uniqueContributors: number | null;

  // ✅ backend poate trimite meta separat
  co?: CoCapsMeta | null;

  key?: CapsuleKeyMeta | null;
};

export type CreateCapsulePayload = {
  title: string;
  description?: string | null;
  capsule_type: "time" | "co" | "key";

  open_at?: string;
  required_contributors?: number;
  visibility_duration?: number;

  // ✅ contribuția creatorului (optional)
  content_text?: string | null;
  media_url?: string | null;

  // ✅ KEY
  key_plain?: string;
  key_expires_at?: string;
};

export type CreateCapsuleResponse = (Capsule & CoCapsMetaFields) & {
  qr_payload?: string | null;
  has_key?: boolean;
  key_expires_at?: string | null;
};

export type UnlockResponse = {
  ok: boolean;
  media_url: string | null;
};

function pickArr(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.capsules)) return raw.capsules;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

/**
 * ✅ Normalizează capsulele:
 * - dacă backend trimite meta în `row.co` sau direct pe capsule,
 *   o punem direct pe capsule pentru feed.
 */
function normalizeCapsule(row: any): Capsule & CoCapsMetaFields {
  const c: any = row?.capsule ?? row ?? {};
  const co: any = row?.co ?? null;

  // candidate meta from capsule direct
  const directMeta: CoCapsMetaFields = {
    contributorsCount: c?.contributorsCount ?? c?.contributors_count ?? null,
    required_contributors: c?.required_contributors ?? null,
    isFull: c?.isFull ?? c?.is_full ?? null,
    canContribute: c?.canContribute ?? c?.can_contribute ?? null,
  };

  // candidate meta from row.co
  const coMeta: CoCapsMetaFields = {
    contributorsCount: co?.contributorsCount ?? null,
    required_contributors: co?.required_contributors ?? c?.required_contributors ?? null,
    isFull: co?.isFull ?? null,
    canContribute: co?.canContribute ?? null,
  };

  // merge: co meta are prioritate, apoi direct
  const mergedMeta: CoCapsMetaFields = {
    required_contributors:
      coMeta.required_contributors ?? directMeta.required_contributors ?? null,
    contributorsCount: coMeta.contributorsCount ?? directMeta.contributorsCount ?? null,
    isFull: coMeta.isFull ?? directMeta.isFull ?? null,
    canContribute: coMeta.canContribute ?? directMeta.canContribute ?? null,
  };

  return { ...(c as Capsule), ...mergedMeta };
}

function normalizeCapsuleList(rows: any[]): (Capsule & CoCapsMetaFields)[] {
  return (Array.isArray(rows) ? rows : []).map(normalizeCapsule);
}

/**
 * LIST - capsulele mele
 */
export async function getCapsules(): Promise<(Capsule & CoCapsMetaFields)[]> {
  const res = await api.get("/capsules/my");
  return normalizeCapsuleList(pickArr(res.data));
}

/**
 * LIST - toate capsulele (feed helper)
 */
export async function getAllCapsules(
  limit: number = 200
): Promise<(Capsule & CoCapsMetaFields)[]> {
  const res = await api.get("/capsules", { params: { limit } });
  return normalizeCapsuleList(pickArr(res.data));
}

/**
 * DETAILS (capsule + contributions + meta)
 */
export async function getCapsuleById(id: number): Promise<CapsuleDetailsResponse> {
  const res = await api.get(`/capsules/${id}`);
  const data: any = res.data;

  // ✅ normalizăm capsule meta pentru UI
  const capsule = normalizeCapsule(data);

  return {
    capsule,
    contributions: Array.isArray(data?.contributions) ? data.contributions : [],
    uniqueContributors:
      typeof data?.uniqueContributors === "number" ? data.uniqueContributors : null,
    co: data?.co ?? null,
    key: data?.key ?? null,
  };
}

/**
 * CREATE (time/co/key)
 */
export async function createCapsule(
  payload: CreateCapsulePayload
): Promise<CreateCapsuleResponse> {
  const res = await api.post("/capsules", payload);
  // backend poate întoarce direct capsule sau obiect cu meta
  return normalizeCapsule(res.data) as any;
}

/**
 * OPEN capsule (time/co)
 */
export async function openCapsule(id: number): Promise<Capsule> {
  const res = await api.post(`/capsules/${id}/open`);
  return res.data as Capsule;
}

/**
 * ADD contribution
 * POST /capsules/:id/contributions
 */
export async function addCapsuleContribution(
  capsuleId: number,
  payload: { content_text?: string | null; media_url?: string | null }
): Promise<CapsuleContribution> {
  const res = await api.post(`/capsules/${capsuleId}/contributions`, payload);
  return res.data as CapsuleContribution;
}

/**
 * KEY: UNLOCK (introduci parola și primești poza)
 */
export async function unlockKeyCapsule(
  capsuleId: number,
  key: string
): Promise<UnlockResponse> {
  const res = await api.post(`/capsules/${capsuleId}/unlock`, { key });
  return res.data as UnlockResponse;
}

/**
 * KEY: GENERATE KEY (owner)
 */
export async function generateKeyForCapsule(
  capsuleId: number,
  payload?: { expires_at?: string | null; key_plain?: string | null }
): Promise<{ key?: string; expires_at?: string | null; qr_payload?: string | null }> {
  const res = await api.post(`/capsules/${capsuleId}/generate-key`, payload || {});
  return res.data;
}

/**
 * KEY: JOIN WITH KEY (auth)
 */
export async function joinWithKey(
  capsuleId: number,
  key: string
): Promise<{ message?: string }> {
  const res = await api.post(`/capsules/${capsuleId}/join-with-key`, { key });
  return res.data;
}

/**
 * SEARCH CAPSULES
 * - backend: GET /capsules/search?q=
 * - fallback local: ia /capsules și filtrează local
 */
export async function searchCapsules(
  q: string
): Promise<(Capsule & CoCapsMetaFields)[]> {
  const query = String(q || "").trim();
  if (!query) return [];

  try {
    const res = await api.get("/capsules/search", { params: { q: query } });
    return normalizeCapsuleList(pickArr(res.data));
  } catch (e: any) {
    const status = e?.response?.status;

    // endpoint inexistent -> fallback local
    if (status === 404) {
      const arr = await getAllCapsules(200);
      const low = query.toLowerCase();

      return arr.filter((c: any) => {
        const t = String(c.title ?? "").toLowerCase();
        const d = String(c.description ?? "").toLowerCase();
        return t.includes(low) || d.includes(low);
      });
    }

    throw e;
  }
}