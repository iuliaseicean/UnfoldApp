// frontend/lib/users.ts
import api from "@/lib/api";

export type UserItem = {
  id?: number;
  user_id?: number;
  username?: string;
  name?: string;
  email?: string;
  bio?: string | null;
  avatar_url?: string | null;

  // compat snake/camel
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdateMePayload = {
  username?: string;
  name?: string;
  bio?: string;
  email?: string;
  avatar_url?: string;
};

/**
 * Normalizează array responses: uneori vine direct [] sau { users: [] } sau { data: [] } sau { items: [] }
 */
function pickArr(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.users)) return raw.users;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function toIso(v: any): string | undefined {
  if (v == null) return undefined;
  const s = String(v);
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/**
 * Normalizează 1 user (safe)
 */
function mapUser(u: any): UserItem {
  if (!u) return {};

  return {
    id: u.id != null ? Number(u.id) : undefined,
    user_id: u.user_id != null ? Number(u.user_id) : undefined,

    username: u.username ?? undefined,
    name: u.name ?? undefined,
    email: u.email ?? undefined,
    bio: u.bio ?? null,
    avatar_url: u.avatar_url ?? null,

    created_at: toIso(u.created_at) ?? (u.created_at ?? undefined),
    updated_at: toIso(u.updated_at) ?? (u.updated_at ?? undefined),
    createdAt: toIso(u.createdAt) ?? (u.createdAt ?? undefined),
    updatedAt: toIso(u.updatedAt) ?? (u.updatedAt ?? undefined),
  };
}

/**
 * Îți dă un id numeric indiferent dacă vine ca id sau user_id
 */
export function getUserNumericId(u: UserItem | any): number | null {
  const id = u?.id ?? u?.user_id;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * ✅ Search users
 * Compatibil cu:
 * - GET /users/search?q=...
 * - GET /users?query=...
 */
export async function searchUsers(query: string): Promise<UserItem[]> {
  const q = String(query || "").trim();
  if (!q) return [];

  // 1) preferă /users/search
  try {
    const res = await api.get("/users/search", { params: { q } });
    return pickArr(res.data).map(mapUser);
  } catch (e: any) {
    // dacă endpoint-ul nu există → fallback la /users?query=
    const status = e?.response?.status;
    if (status && status !== 404) throw e;

    const res = await api.get("/users", { params: { query: q } });
    return pickArr(res.data).map(mapUser);
  }
}

/**
 * ✅ Get my profile
 * GET /users/me
 */
export async function getMe(): Promise<UserItem | null> {
  const res = await api.get("/users/me");
  return res.data ? mapUser(res.data) : null;
}

/**
 * ✅ Update my profile
 * PATCH /users/me
 */
export async function updateMe(payload: UpdateMePayload): Promise<UserItem> {
  const res = await api.patch("/users/me", payload);
  return mapUser(res.data);
}

/**
 * ✅ Get user profile by id (pentru tap din Search)
 *
 * Backend recomandat: GET /users/:id
 * Dacă nu există încă endpoint-ul, facem fallback: căutăm după id în /users/search (weak) sau returnăm null.
 */
export async function getUserById(id: number): Promise<UserItem | null> {
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  // 1) încercăm endpoint dedicat
  try {
    const res = await api.get(`/users/${userId}`);
    return res.data ? mapUser(res.data) : null;
  } catch (e: any) {
    const status = e?.response?.status;

    // 404 -> endpoint nu există sau userul nu există -> fallback minimal
    if (status === 404) {
      // fallback: încercăm să-l găsim prin search (nu e ideal, dar ajută MVP)
      try {
        const res2 = await api.get("/users/search", { params: { q: String(userId) } });
        const arr = pickArr(res2.data).map(mapUser);
        const found = arr.find((u) => getUserNumericId(u) === userId);
        return found ?? null;
      } catch {
        return null;
      }
    }

    // 401/500/network -> eroare reală
    throw e;
  }
}