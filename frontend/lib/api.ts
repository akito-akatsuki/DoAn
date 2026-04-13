import { supabase } from "./supabaseClient";

/* =========================
   GET FEED
========================= */
export const getFeed = async () => {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      *,
      users (
        id,
        name,
        avatar_url
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getFeed error:", error);
    throw error;
  }

  return data;
};

/* =========================
   CREATE POST
========================= */
export const createPost = async (payload: {
  content: string;
  image_url?: string | null;
}) => {
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("posts")
    .insert({
      content: payload.content,
      image_url: payload.image_url ?? null,
      user_id: user.id,
    })
    .select(
      `
      *,
      users (
        id,
        name,
        avatar_url
      )
    `,
    )
    .single();

  if (error) {
    console.error("createPost error:", error);
    throw error;
  }

  return data;
};

/* =========================
   TOGGLE LIKE
========================= */
export const toggleLike = async (postId: string) => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) throw new Error("Not authenticated");

  // check đã like chưa
  const { data: existing } = await supabase
    .from("likes")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
  } else {
    await supabase.from("likes").insert({
      post_id: postId,
      user_id: userId,
    });
  }

  // update count
  const { count } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  return {
    is_liked: !existing,
    likes_count: count || 0,
  };
};

/* =========================
   GET COMMENTS
========================= */
export const getComments = async (postId: string) => {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      *,
      users (
        id,
        name,
        avatar_url
      )
    `,
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getComments error:", error);
    throw error;
  }

  return data;
};

/* =========================
   CREATE COMMENT
========================= */
export const createComment = async (postId: string, content: string) => {
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      content,
      user_id: user.id,
    })
    .select(
      `
      *,
      users (
        id,
        name,
        avatar_url
      )
    `,
    )
    .single();

  if (error) {
    console.error("createComment error:", error);
    throw error;
  }

  return data;
};
