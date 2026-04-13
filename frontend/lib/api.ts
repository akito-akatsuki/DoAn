import { supabase } from "./supabaseClient";

const API_URL = "http://localhost:5000";

// ============================
// GET FEED
// ============================

export const getFeed = async () => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      content,
      image_url,
      created_at,
      user_id,
      users (
        id,
        name,
        avatar_url
      ),
      likes (
        id,
        user_id
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((post) => ({
    id: post.id, // ✅ force stable id
    content: post.content,
    image_url: post.image_url,
    created_at: post.created_at,

    users: post.users ?? {
      name: "unknown",
      avatar_url: null,
    },

    likes_count: post.likes?.length ?? 0,

    is_liked: post.likes?.some((l) => l.user_id === userId) ?? false,

    likes: post.likes ?? [],
  }));
};

// ============================
// CREATE POST
// ============================
export const createPost = async (payload: {
  content: string;
  image_url?: string | null;
}) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${API_URL}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  return res.json();
};
// 🔥 LIKE TOGGLE
export const toggleLike = async (postId: string, userId: string) => {
  const res = await fetch(`${API_URL}/posts/${postId}/like`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
    }),
  });

  return res.json();
};

// 🔥 COMMENTS
export const getComments = async (postId: string) => {
  const res = await fetch(`${API_URL}/comments/${postId}`);
  return res.json();
};

export const createComment = async (postId: string, content: string) => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) throw new Error("Not authenticated");

  const res = await fetch(`http://localhost:5000/comments/${postId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      user_id: userId, // ✅ FIX QUAN TRỌNG
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Create comment failed");
  }

  return await res.json();
};
