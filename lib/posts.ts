import api from "@/lib/api";

export type PostUser = {
  id: number;
  name: string;
  avatar_url: string | null;
};

export type PostItem = {
  id: number;
  user_id: number;
  content_text: string;
  media_url: string | null;
  visibility: string;
  created_at: string;
  User?: PostUser;
};

export async function getPosts(): Promise<PostItem[]> {
  const res = await api.get("/content/posts");
  const raw = res.data;

  // suportă mai multe forme de răspuns
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.posts)
    ? raw.posts
    : Array.isArray(raw?.data)
    ? raw.data
    : [];

  // normalizează cheile ca să se potrivească cu tipul tău
  return arr.map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    content_text: p.content_text,
    media_url: p.media_url ?? null,
    visibility: p.visibility,
    created_at: p.created_at ?? p.createdAt, // backend trimite createdAt
    User: p.User
      ? {
          id: p.User.id,
          name: p.User.name ?? p.User.username ?? "User", // backend are username
          avatar_url: p.User.avatar_url ?? null,
        }
      : undefined,
  }));
}


export async function createPost(payload: {
  content_text: string;
  media_url?: string | null;
  visibility?: string;
}) {
  const res = await api.post("/content/posts", payload);
  return res.data;
}
