import api from "@/lib/api";

export type PostUser = {
  id: number;
  username?: string;
  name?: string;
  avatar_url: string | null;
};

export type PostItem = {
  id: number;
  user_id: number;
  content_text: string;
  media_url: string | null;
  visibility: string;
  created_at: string;

  likeCount?: number;
  commentCount?: number;

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
  return [];
}

export async function getPosts(): Promise<PostItem[]> {
  const res = await api.get("/content/posts");
  const arr = pickArr(res.data);

  return arr.map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    content_text: p.content_text ?? "",
    media_url: p.media_url ?? null,
    visibility: p.visibility ?? "public",
    created_at: p.created_at ?? p.createdAt,

    likeCount: typeof p.likeCount === "number" ? p.likeCount : Number(p.likeCount ?? 0),
    commentCount: typeof p.commentCount === "number" ? p.commentCount : Number(p.commentCount ?? 0),

    User: p.User
      ? {
          id: p.User.id,
          username: p.User.username,
          name: p.User.name,
          avatar_url: p.User.avatar_url ?? null,
        }
      : undefined,
  }));
}

export async function createPost(payload: {
  content_text: string | null;
  media_url?: string | null;
  visibility?: string;
}) {
  const res = await api.post("/content/posts", payload);
  return res.data;
}

export async function likePost(postId: number) {
  const res = await api.post(`/content/posts/${postId}/like`);
  return res.data;
}

export async function unlikePost(postId: number) {
  const res = await api.delete(`/content/posts/${postId}/like`);
  return res.data;
}

export async function getPostComments(postId: number): Promise<PostCommentItem[]> {
  const res = await api.get(`/content/posts/${postId}/comments`);
  const arr = pickArr(res.data);

  return arr.map((c: any) => ({
    id: c.id,
    post_id: c.post_id,
    user_id: c.user_id,
    content_text: c.content_text ?? "",
    created_at: c.created_at ?? c.createdAt,
    User: c.User
      ? {
          id: c.User.id,
          username: c.User.username,
          name: c.User.name,
          avatar_url: c.User.avatar_url ?? null,
        }
      : undefined,
  }));
}

export async function addPostComment(postId: number, content_text: string) {
  const res = await api.post(`/content/posts/${postId}/comments`, { content_text });
  return res.data;
}
