import api from "@/lib/api";

export type UserItem = {
  id?: number;
  user_id?: number;
  username?: string;
  name?: string;
  email?: string;
  bio?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
};

/**
 * Normalizează răspunsul din backend: uneori vine { data: [...] } sau { users: [...] }
 */
function pickArr(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.users)) return raw.users;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

/**
 * ✅ Search users
 * Compatibil cu ambele stiluri de backend:
 * - GET /users/search?q=...
 * - GET /users?query=...
 */
export async function searchUsers(query: string): Promise<UserItem[]> {
  const q = String(query || "").trim();
  if (!q) return [];

  // 1) preferă /users/search
  try {
    const res = await api.get("/users/search", { params: { q } });
    return pickArr(res.data) as UserItem[];
  } catch (e: any) {
    // dacă endpoint-ul nu există → fallback la /users?query=
    const status = e?.response?.status;
    if (status && status !== 404) throw e;

    const res = await api.get("/users", { params: { query: q } });
    return pickArr(res.data) as UserItem[];
  }
}

/**
 * ✅ Get my profile (optional helper)
 * GET /users/me
 */
export async function getMe(): Promise<UserItem | null> {
  const res = await api.get("/users/me");
  return res.data ?? null;
}

/**
 * ✅ Update my profile (optional helper)
 * PATCH /users/me
 */
export async function updateMe(payload: {
  username?: string;
  name?: string;
  bio?: string;
  email?: string;
  avatar_url?: string;
}): Promise<UserItem> {
  const res = await api.patch("/users/me", payload);
  return res.data;
}