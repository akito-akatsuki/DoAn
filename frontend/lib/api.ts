import { supabase } from "./supabaseClient";

/* =========================
   SAFE ERROR HANDLER
========================= */
const handleError = (error: any, label: string) => {
  console.error(`${label} error:`, JSON.stringify(error, null, 2));
  throw new Error(error?.message || `${label} thất bại`);
};

/* =========================
   GET FEED
========================= */
export const getFeed = async () => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  // 1. Get hot post IDs from RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_hot_feed",
    {
      current_user_id: userId,
    },
  );
  if (rpcError) {
    console.warn("getFeed RPC Error, falling back to recent posts:", rpcError);
  }

  const postIdsFromRpc = (rpcData || []).map((p: any) => p.id);

  // 2. Fetch fallback post IDs if needed
  let fallbackPostIds: string[] = [];
  if (postIdsFromRpc.length < 10) {
    const { data: fallbackPosts, error: fallbackError } = await supabase
      .from("posts")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(30);

    if (fallbackError) {
      console.warn("getFeed fallback error:", fallbackError);
    }
    if (fallbackPosts) {
      fallbackPostIds = fallbackPosts
        .map((p) => p.id)
        .filter((id) => !postIdsFromRpc.includes(id));
    }
  }

  const allPostIds = [...new Set([...postIdsFromRpc, ...fallbackPostIds])];

  if (allPostIds.length === 0) return [];

  // 3. Fetch all data in parallel
  const [postsRes, savedRes] = await Promise.all([
    supabase
      .from("posts")
      .select("*, users (id, name, avatar_url), pages (id, name, avatar_url)")
      .in("id", allPostIds),
    userId
      ? supabase
          .from("saved_posts")
          .select("post_id")
          .eq("user_id", userId)
          .in("post_id", allPostIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (postsRes.error) handleError(postsRes.error, "getFeed posts");
  if (savedRes.error) handleError(savedRes.error, "getFeed saved");

  const allPosts = postsRes.data || [];
  const savedSet = new Set((savedRes.data || []).map((s: any) => s.post_id));
  const rpcDataMap = new Map((rpcData || []).map((p: any) => [p.id, p]));

  // 4. Enrich and sort
  let enrichedData = allPosts.map((post) => {
    const rpcInfo = rpcDataMap.get(post.id);
    return {
      ...post,
      ...(rpcInfo || {}), // Add score etc. from RPC
      is_saved: savedSet.has(post.id),
    };
  });

  // 5. Sắp xếp lại theo thứ tự ưu tiên
  const now = Date.now();
  const NEW_THRESHOLD = 2 * 60 * 60 * 1000; // 2 tiếng (được coi là bài mới đăng)

  enrichedData.sort((a, b) => {
    const timeA = new Date(
      a.created_at.includes("Z") || a.created_at.includes("+")
        ? a.created_at
        : `${a.created_at}Z`,
    ).getTime();
    const timeB = new Date(
      b.created_at.includes("Z") || b.created_at.includes("+")
        ? b.created_at
        : `${b.created_at}Z`,
    ).getTime();

    const isNewA = now - timeA < NEW_THRESHOLD;
    const isNewB = now - timeB < NEW_THRESHOLD;

    // Đặc biệt: Bài mới đăng (trong vòng 2h) được đẩy lên trên cùng tuyệt đối
    if (isNewA && !isNewB) return -1;
    if (!isNewA && isNewB) return 1;

    // Phân loại mức độ ưu tiên
    const getPriority = (post: any) => {
      if (post.page_id) return 1; // Ưu tiên 1: Fanpage
      if (post.user_id !== userId) return 2; // Ưu tiên 2: Người khác
      return 3; // Ưu tiên 3: Bản thân
    };

    const prioA = getPriority(a);
    const prioB = getPriority(b);

    if (prioA !== prioB) {
      return prioA - prioB; // Xếp theo 1 -> 2 -> 3
    }

    // Nếu cùng mức độ ưu tiên -> Bài nào mới hơn xếp trên
    return timeB - timeA;
  });

  return enrichedData;
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

  if (!user) throw new Error("Chưa đăng nhập");

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

  if (!userId) throw new Error("Chưa đăng nhập");

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
export const createComment = async (
  postId: string,
  content: string,
  imageUrl?: string | null,
) => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("Chưa đăng nhập");

  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      content,
      image_url: imageUrl || null,
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

  if (!user) throw new Error("Chưa đăng nhập");

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

  if (!user) throw new Error("Chưa đăng nhập");

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

  if (!user) throw new Error("Chưa đăng nhập");

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
    if (error) throw new Error(error.message || "Lỗi lưu/bỏ lưu bài viết");
    return { is_saved: false };
  } else {
    const { error } = await supabase.from("saved_posts").insert({
      user_id: user.id,
      post_id: postId,
    });
    if (error) throw new Error(error.message || "Lỗi lưu/bỏ lưu bài viết");
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

  if (error) throw new Error(error.message || "Lỗi báo cáo bài viết");
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
  if (!user) throw new Error("Chưa đăng nhập");

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
    post_permission?: string;
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
