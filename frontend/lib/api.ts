import { supabase } from "./supabaseClient";

/* =========================
   SAFE ERROR HANDLER
========================= */
const handleError = (error: any, label: string) => {
  console.error(`${label} error:`, error);
  throw new Error(error?.message || `${label} failed`);
};

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

  if (error) handleError(error, "getFeed");

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userId && data) {
    const { data: savedPosts } = await supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", userId);

    const savedSet = new Set(savedPosts?.map((s) => s.post_id) || []);

    return data.map((post) => ({
      ...post,
      is_saved: savedSet.has(post.id),
    }));
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

  if (error) handleError(error, "createPost");

  return data;
};

/* =========================
   TOGGLE LIKE
========================= */
export const toggleLike = async (postId: string) => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) throw new Error("Not logged in");

  const { data: existing, error: findError } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (findError) handleError(findError, "toggleLike-find");

  if (existing) {
    const { error: deleteError } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);

    if (deleteError) handleError(deleteError, "toggleLike-delete");
  } else {
    const { error: insertError } = await supabase.from("likes").insert({
      post_id: postId,
      user_id: userId,
    });

    if (insertError) handleError(insertError, "toggleLike-insert");
  }

  const [{ count }, { data: checkLike, error: checkError }] = await Promise.all(
    [
      supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId),

      supabase
        .from("likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle(),
    ],
  );

  if (checkError) handleError(checkError, "toggleLike-check");

  return {
    is_liked: !!checkLike,
    likes_count: count ?? 0,
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

  if (error) handleError(error, "getComments");

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

  if (error) handleError(error, "createComment");

  return data;
};

/* =========================
   DELETE COMMENT
========================= */
export const deleteComment = async (commentId: string) => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) handleError(error, "deleteComment");
  return true;
};

/* =========================
   UPDATE COMMENT
========================= */
export const updateComment = async (commentId: string, content: string) => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("comments")
    .update({ content })
    .eq("id", commentId)
    .eq("user_id", user.id)
    .select("*, users (id, name, avatar_url)")
    .single();

  if (error) handleError(error, "updateComment");
  return data;
};

// TOGGLE SAVE POST
export const toggleSavePost = async (postId: string) => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("Not authenticated");

  // Kiểm tra xem đã lưu chưa
  const { data: existing } = await supabase
    .from("saved_posts")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return { is_saved: false };
  } else {
    const { error } = await supabase.from("saved_posts").insert({
      user_id: user.id,
      post_id: postId,
    });
    if (error) throw error;
    return { is_saved: true };
  }
};

// REPORT POST
export const reportPost = async (postId: string, reason: string = "spam") => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return;

  const { data, error } = await supabase.from("reports").insert({
    user_id: user.id,
    post_id: postId,
    reason,
  });

  if (error) throw error;
  return data;
};
