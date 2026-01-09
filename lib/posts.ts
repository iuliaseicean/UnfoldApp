// frontend/lib/posts.ts
import api from "@/lib/api";

export type PostUser = {
  id?: number;
  user_id?: number;
  username?: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
};

export type PostItem = {
  id: number;
  user_id: number;
  content_text: string;
  media_url: string | null;
  visibility: string;
  created_at: string;

  likeCount: number;
  commentCount: number;

  User?: PostUser;

  /**
   * ✅ Delete permissions (din backend, dacă există)
   * - canDelete: backend spune clar că user-ul curent poate șterge postarea
   * - isMine: helper (în UI) - true dacă postarea e a mea
   */
  canDelete?: boolean;
  isMine?: boolean;
};

export type PostCommentItem = {
  id: number;
  post_id: number;
  user_id: number;
  content_text: string;
  created_at: string;
  User?: PostUser;
};

export type CreatePostPayload = {
  content_text: string | null;
  media_url?: string | null;
  visibility?: string;
};

/**
 * Normalizează răspunsul din backend: uneori vine array, alteori {posts:[]}, {data:[]}, {items:[]}
 */
function pickArr(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.posts)) return raw.posts;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function toIso(v: any) {
  const s = String(v ?? "");
  const t = Date.parse(s);
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

function mapUser(u: any): PostUser | undefined {
  if (!u) return undefined;
  return {
    id: u.id != null ? Number(u.id) : undefined,
    user_id: u.user_id != null ? Number(u.user_id) : undefined,
    username: u.username ?? undefined,
    name: u.name ?? undefined,
    email: u.email ?? undefined,
    avatar_url: u.avatar_url ?? null,
  };
}

/**
 * ✅ mapPost:
 * - suportă id / post_id
 * - suportă user_id / userId
 * - suportă content_text / contentText
 * - suportă media_url / mediaUrl
 * - preia canDelete dacă backend-ul îl oferă
 */
function mapPost(p: any): PostItem {
  const id = Number(p?.id ?? p?.post_id ?? 0);
  const user_id = Number(p?.user_id ?? p?.userId ?? 0);

  const created_at = p?.created_at
    ? toIso(p.created_at)
    : p?.createdAt
    ? toIso(p.createdAt)
    : new Date().toISOString();

  const canDelete =
    typeof p?.canDelete === "boolean"
      ? p.canDelete
      : typeof p?.can_delete === "boolean"
      ? p.can_delete
      : undefined;

  return {
    id,
    user_id,
    content_text: String(p?.content_text ?? p?.contentText ?? ""),
    media_url: p?.media_url ?? p?.mediaUrl ?? null,
    visibility: String(p?.visibility ?? "public"),
    created_at,

    likeCount: Number(p?.likeCount ?? 0),
    commentCount: Number(p?.commentCount ?? 0),

    User: mapUser(p?.User),

    canDelete,
    // isMine rămâne undefined aici (nu știm user-ul curent în lib),
    // dar UI-ul îl poate seta dacă are userId local.
    isMine: typeof p?.isMine === "boolean" ? p.isMine : undefined,
  };
}

function mapComment(c: any, fallbackPostId?: number): PostCommentItem {
  return {
    id: Number(c?.id ?? 0),
    post_id: Number(c?.post_id ?? c?.postId ?? fallbackPostId ?? 0),
    user_id: Number(c?.user_id ?? c?.userId ?? 0),
    content_text: String(c?.content_text ?? c?.contentText ?? ""),
    created_at: c?.created_at ? toIso(c.created_at) : c?.createdAt ? toIso(c.createdAt) : new Date().toISOString(),
    User: mapUser(c?.User),
  };
}

/**
 * Helper pt navigare: întoarce id numeric valid sau null
 */
export function getPostNumericId(p: PostItem | any): number | null {
  const n = Number(p?.id ?? p?.post_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * ✅ Feed posts
 * Backend: GET /content/posts
 */
export async function getPosts(): Promise<PostItem[]> {
  const res = await api.get("/content/posts");
  const arr = pickArr(res.data);
  return arr.map(mapPost);
}

/**
 * ✅ Get single post by id
 * Backend: GET /content/posts/:id
 */
export async function getPostById(postId: number): Promise<PostItem | null> {
  const id = Number(postId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const res = await api.get(`/content/posts/${id}`);
  const item = res.data;

  if (!item) return null;
  if (Array.isArray(item)) return item.length ? mapPost(item[0]) : null;

  return mapPost(item);
}

/**
 * ✅ Create post
 * Backend: POST /content/posts
 */
export async function createPost(payload: CreatePostPayload): Promise<PostItem> {
  const res = await api.post("/content/posts", payload);
  return mapPost(res.data);
}

/**
 * ✅ Like / Unlike
 * Backend: POST /content/posts/:id/like
 *          DELETE /content/posts/:id/like
 */
export async function likePost(postId: number) {
  const res = await api.post(`/content/posts/${postId}/like`);
  return res.data;
}

export async function unlikePost(postId: number) {
  const res = await api.delete(`/content/posts/${postId}/like`);
  return res.data;
}

/**
 * ✅ Comments
 * Backend: GET /content/posts/:id/comments
 *          POST /content/posts/:id/comments
 */
export async function getPostComments(postId: number): Promise<PostCommentItem[]> {
  const res = await api.get(`/content/posts/${postId}/comments`);
  const arr = pickArr(res.data);
  return arr.map((c: any) => mapComment(c, postId));
}

export async function addPostComment(postId: number, content_text: string): Promise<PostCommentItem> {
  const res = await api.post(`/content/posts/${postId}/comments`, { content_text });

  // uneori backend-ul întoarce { comment, likeCount, commentCount }
  const payload = res.data?.comment ?? res.data;
  return mapComment(payload, postId);
}

/**
 * ✅ Posts by user (pentru pagina de profil a altui user)
 * Backend recomandat: GET /users/:id/posts
 * Fallback: dacă nu există endpoint-ul, filtrează local din getPosts()
 */
export async function getPostsByUserId(userId: number): Promise<PostItem[]> {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return [];

  try {
    const res = await api.get(`/users/${id}/posts`);
    const arr = pickArr(res.data);
    return arr.map(mapPost);
  } catch (e: any) {
    const status = e?.response?.status;

    if (status === 404) {
      const all = await getPosts();
      return all.filter((p) => Number(p.user_id) === id);
    }

    throw e;
  }
}

/**
 * ✅ Delete post (doar owner - backend trebuie să verifice)
 * Backend: DELETE /content/posts/:id
 */
export async function deletePost(postId: number): Promise<{ ok?: boolean }> {
  const id = Number(postId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid postId");

  const res = await api.delete(`/content/posts/${id}`);
  return res.data;
}

/**
 * ✅ SEARCH POSTS separat
 * Recomandat backend: GET /content/posts/search?q=
 * Dacă NU există încă endpoint-ul, facem fallback local din getPosts().
 */
export async function searchPosts(q: string): Promise<PostItem[]> {
  const query = String(q || "").trim();
  if (!query) return [];

  try {
    const res = await api.get("/content/posts/search", { params: { q: query } });
    const arr = pickArr(res.data);
    return arr.map(mapPost);
  } catch (e: any) {
    const status = e?.response?.status;

    if (status === 404) {
      const all = await getPosts();
      const low = query.toLowerCase();
      return all.filter((p) => {
        const t = (p.content_text || "").toLowerCase();
        const u = (p.User?.username || "").toLowerCase();
        const n = (p.User?.name || "").toLowerCase();
        return t.includes(low) || u.includes(low) || n.includes(low);
      });
    }

    throw e;
  }
}