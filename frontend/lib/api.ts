import { supabase } from "./supabaseClient";

/* =========================
   SAFE ERROR HANDLER
========================= */
const handleError = (error: any, label: string) => {
  console.error(`${label} error:`, JSON.stringify(error, null, 2));
  throw new Error(error?.message || `${label} failed`);
};

/* =========================
   GET FEED
========================= */
export const getFeed = async () => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  // 1. Gọi RPC tính điểm Hot Score (Thuật toán gợi ý)
  const { data, error } = await supabase.rpc("get_hot_feed", {
    current_user_id: userId,
  });

  // Nếu bị lỗi (do bạn chưa tạo Function SQL), tự động Fallback về cách lấy cũ an toàn
  if (error) {
    console.warn(
      "Chưa tìm thấy hàm get_hot_feed trên Supabase, fallback lấy bài viết mới nhất...",
      error.message,
    );
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("posts")
      .select("*, users (id, name, avatar_url), pages (id, name, avatar_url)")
      .order("created_at", { ascending: false });

    if (fallbackError) handleError(fallbackError, "getFeed fallback");

    if (userId && fallbackData) {
      const { data: savedPosts } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", userId);
      const savedSet = new Set(savedPosts?.map((s) => s.post_id) || []);
      return fallbackData.map((post) => ({
        ...post,
        is_saved: savedSet.has(post.id),
      }));
    }
    return fallbackData;
  }

  // 2. Vì Hàm SQL (RPC) không trả về relations (users, pages), ta fetch bổ sung và ghép vào
  if (data && data.length > 0) {
    const postIds = data.map((p: any) => p.id);

    // Truy vấn trực tiếp từ bảng posts để lấy thông tin đầy đủ và relations
    const { data: fullPosts, error: fullError } = await supabase
      .from("posts")
      .select("*, users (id, name, avatar_url), pages (id, name, avatar_url)")
      .in("id", postIds);

    if (fullError) handleError(fullError, "getFeed fullPosts");

    // Tạo một Map để tra cứu thông tin đầy đủ của bài viết một cách hiệu quả
    const fullPostsMap = new Map((fullPosts || []).map((p: any) => [p.id, p]));

    // Duyệt qua kết quả từ RPC (đã được sắp xếp) và bổ sung thông tin
    const enrichedData = data
      .map((rpcPost: any) => {
        const fullPost = fullPostsMap.get(rpcPost.id);
        if (!fullPost) return null; // Bỏ qua nếu bài viết không còn tồn tại

        return { ...fullPost, ...rpcPost };
      })
      .filter(Boolean); // Lọc ra các kết quả null

    return enrichedData;
  }

  return data;
};

/* =========================
   CREATE POST
========================= */
export const createPost = async (payload: {
  content: string;
  image_url?: string | null;
  is_flagged?: boolean;
  page_id?: string | null;
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
      is_flagged: payload.is_flagged ?? false,
      page_id: payload.page_id ?? null,
    })
    .select(
      `
      *,
      users (
        id,
        name,
        avatar_url
      ),
      pages ( id, name, avatar_url )
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

/* =========================
   PAGES (FANPAGE) API
========================= */
export const createPage = async (payload: {
  name: string;
  bio?: string;
  avatar_url?: string | null;
  cover_url?: string | null;
}) => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("pages")
    .insert({
      name: payload.name,
      bio: payload.bio || null,
      avatar_url: payload.avatar_url || null,
      cover_url: payload.cover_url || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) handleError(error, "createPage");

  // Tự động thêm người tạo làm admin
  await supabase.from("page_admins").insert({
    page_id: data.id,
    user_id: user.id,
    role: "admin",
  });

  return data;
};

export const getUserPages = async () => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("page_admins")
    .select("page_id, pages(*)")
    .eq("user_id", userData.user.id);
  if (error) return [];
  return data.map((d: any) => d.pages);
};

export const updatePageInfo = async (
  pageId: string,
  payload: {
    name?: string;
    bio?: string;
    avatar_url?: string | null;
    cover_url?: string | null;
    cover_position_y?: number | null;
  },
) => {
  const { data, error } = await supabase
    .from("pages")
    .update(payload)
    .eq("id", pageId)
    .select()
    .single();
  if (error) handleError(error, "updatePageInfo");
  return data;
};

export const getPageAdmins = async (pageId: string) => {
  const { data, error } = await supabase
    .from("page_admins")
    .select("role, users (id, name, avatar_url)")
    .eq("page_id", pageId);
  if (error) handleError(error, "getPageAdmins");
  return data;
};

export const addPageAdmin = async (pageId: string, userId: string) => {
  const { data, error } = await supabase
    .from("page_admins")
    .insert({ page_id: pageId, user_id: userId, role: "admin" });
  if (error) handleError(error, "addPageAdmin");
  return data;
};

export const removePageAdmin = async (pageId: string, userId: string) => {
  const { error } = await supabase
    .from("page_admins")
    .delete()
    .match({ page_id: pageId, user_id: userId });
  if (error) handleError(error, "removePageAdmin");
  return true;
};

export const getPageMembers = async (pageId: string) => {
  const { data, error } = await supabase
    .from("page_followers")
    .select("users (id, name, avatar_url)")
    .eq("page_id", pageId);
  if (error) handleError(error, "getPageMembers");
  return data;
};

export const removePageMember = async (pageId: string, userId: string) => {
  const { error } = await supabase
    .from("page_followers")
    .delete()
    .match({ page_id: pageId, user_id: userId });
  if (error) handleError(error, "removePageMember");
  return true;
};

export const deletePage = async (pageId: string) => {
  const { error } = await supabase.from("pages").delete().eq("id", pageId);
  if (error) handleError(error, "deletePage");
  return true;
};
