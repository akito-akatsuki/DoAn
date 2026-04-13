import { supabase } from "./supabaseClient";

const API_URL = "http://localhost:5000";

/* =========================
   GET FEED
========================= */
export const getFeed = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch(`${API_URL}/posts/feed`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  return data;
};

/* =========================
   CREATE POST
========================= */
export const createPost = async (payload: {
  content: string;
  image_url?: string | null;
}) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch(`${API_URL}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return await res.json();
};

/* =========================
   TOGGLE LIKE
========================= */
export const toggleLike = async (postId: string) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch(`${API_URL}/posts/${postId}/like`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return await res.json();
};

/* =========================
   COMMENTS
========================= */
export const getComments = async (postId: string) => {
  const res = await fetch(`${API_URL}/comments/${postId}`);
  return await res.json();
};

export const createComment = async (postId: string, content: string) => {
  const { data: sessionData } = await supabase.auth.getUser();
  const userId = sessionData.user?.id;

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;

  const res = await fetch(`${API_URL}/comments/${postId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content,
      user_id: userId,
    }),
  });

  return await res.json();
};
