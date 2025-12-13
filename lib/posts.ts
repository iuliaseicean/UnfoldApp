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
  return res.data;
}

export async function createPost(payload: {
  content_text: string;
  media_url?: string | null;
  visibility?: string;
}) {
  const res = await api.post("/content/posts", payload);
  return res.data;
}
