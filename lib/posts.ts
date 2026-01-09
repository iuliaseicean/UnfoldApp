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
};

export type PostCommentItem = {
  id: number;
  post_id: number;
  user_id: number;
  content_text: string;
  created_at: string;
  User?: PostUser;
};

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

function mapPost(p: any): PostItem {
  const id = Number(p.id ?? p.post_id);
  return {
    id,
    user_id: Number(p.user_id ?? p.userId ?? 0),
    content_text: String(p.content_text ?? p.contentText ?? ""),
    media_url: p.media_url ?? p.mediaUrl ?? null,
    visibility: String(p.visibility ?? "public"),
    created_at: p.created_at
      ? toIso(p.created_at)
      : p.createdAt
      ? toIso(p.createdAt)
      : new Date().toISOString(),

    likeCount: Number(p.likeCount ?? 0),
    commentCount: Number(p.commentCount ?? 0),

    User: mapUser(p.User),
  };
}

function mapComment(c: any, fallbackPostId?: number): PostCommentItem {
  return {
    id: Number(c.id),
    post_id: Number(c.post_id ?? c.postId ?? fallbackPostId ?? 0),
    user_id: Number(c.user_id ?? c.userId ?? 0),
    content_text: String(c.content_text ?? c.contentText ?? ""),
    created_at: c.created_at ? toIso(c.created_at) : c.createdAt ? toIso(c.createdAt) : new Date().toISOString(),
    User: mapUser(c.User),
  };
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
 * ✅ Create post
 * Backend: POST /content/posts
 */
export async function createPost(payload: {
  content_text: string | null;
  media_url?: string | null;
  visibility?: string;
}): Promise<PostItem> {
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
  return mapComment(res.data, postId);
}

/**
 * ✅ SEARCH POSTS separat
 * Recomandat backend: GET /content/posts/search?q=
 * Dacă NU există încă endpoint-ul, facem fallback local din getPosts().
 */
export async function searchPosts(q: string): Promise<PostItem[]> {
  const query = q.trim();
  if (!query) return [];

  try {
    const res = await api.get("/content/posts/search", { params: { q: query } });
    const arr = pickArr(res.data);
    return arr.map(mapPost);
  } catch (e: any) {
    const status = e?.response?.status;

    // dacă endpoint-ul nu există -> fallback local
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

    // altfel: eroare reală (401/500/network)
    throw e;
  }
}