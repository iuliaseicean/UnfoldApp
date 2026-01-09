import api from "@/lib/api";
import { Capsule } from "@/types/capsule";

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
  capsule: Capsule;
  contributions: CapsuleContribution[];
  uniqueContributors: number | null;
  key?: CapsuleKeyMeta | null;
};

export type CreateCapsulePayload = {
  title: string;
  description?: string | null;
  capsule_type: "time" | "co" | "key";
  open_at?: string;
  required_contributors?: number;
  visibility_duration?: number;

  // KEY capsule (MVP)
  key_plain?: string;
  media_url?: string;
  key_expires_at?: string;
};

export type CreateCapsuleResponse = Capsule & {
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

/** LIST - capsulele mele */
export async function getCapsules(): Promise<Capsule[]> {
  const res = await api.get("/capsules/my");
  return pickArr(res.data) as Capsule[];
}

/** LIST - toate capsulele (feed helper) */
export async function getAllCapsules(limit: number = 200): Promise<Capsule[]> {
  const res = await api.get("/capsules", { params: { limit } });
  return pickArr(res.data) as Capsule[];
}

/** DETAILS */
export async function getCapsuleById(id: number): Promise<CapsuleDetailsResponse> {
  const res = await api.get<CapsuleDetailsResponse>(`/capsules/${id}`);
  return res.data;
}

/** CREATE (time/co/key) */
export async function createCapsule(payload: CreateCapsulePayload): Promise<CreateCapsuleResponse> {
  const res = await api.post("/capsules", payload);
  return res.data;
}

/** OPEN capsule (time/co) */
export async function openCapsule(id: number): Promise<Capsule> {
  const res = await api.post(`/capsules/${id}/open`);
  return res.data;
}

/** ADD contribution */
export async function addCapsuleContribution(
  capsuleId: number,
  payload: { content_text?: string | null; media_url?: string | null }
): Promise<CapsuleContribution> {
  const res = await api.post(`/capsules/${capsuleId}/contributions`, payload);
  return res.data;
}

/** KEY: UNLOCK (introduci parola și primești poza) */
export async function unlockKeyCapsule(capsuleId: number, key: string): Promise<UnlockResponse> {
  const res = await api.post(`/capsules/${capsuleId}/unlock`, { key });
  return res.data;
}

/** KEY: GENERATE KEY (owner) – păstrat pentru compatibilitate */
export async function generateKeyForCapsule(
  capsuleId: number,
  payload?: { expires_at?: string | null; key_plain?: string | null }
): Promise<{ key?: string; expires_at?: string | null; qr_payload?: string | null }> {
  const res = await api.post(`/capsules/${capsuleId}/generate-key`, payload || {});
  return res.data;
}

/** KEY: JOIN WITH KEY (auth) – păstrat */
export async function joinWithKey(capsuleId: number, key: string): Promise<{ message?: string }> {
  const res = await api.post(`/capsules/${capsuleId}/join-with-key`, { key });
  return res.data;
}

/**
 * ✅ SEARCH CAPSULES separat
 * - backend recomandat: GET /capsules/search?q=
 * - fallback local: ia /capsules și filtrează local
 */
export async function searchCapsules(q: string): Promise<Capsule[]> {
  const query = q.trim();
  if (!query) return [];

  try {
    const res = await api.get("/capsules/search", { params: { q: query } });
    return pickArr(res.data) as Capsule[];
  } catch (e: any) {
    const status = e?.response?.status;

    // endpoint inexistent -> fallback local
    if (status === 404) {
      const arr = (await getAllCapsules(200)) as any[];
      const low = query.toLowerCase();

      return arr.filter((c: any) => {
        const t = String(c.title ?? "").toLowerCase();
        const d = String(c.description ?? "").toLowerCase();
        return t.includes(low) || d.includes(low);
      }) as Capsule[];
    }

    // altă eroare reală
    throw e;
  }
}