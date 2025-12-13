export type Post = {
  post_id: number;
  user_id: number;
  text?: string | null;
  media_url?: string | null;
  created_at?: string | null;

  // opțional, dacă backend-ul returnează user inclus
  user?: {
    id: number;
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  };
};

export type CreatePostPayload = {
  text?: string;
  media_url?: string | null;
};
