import { supabase } from "./supabaseClient";

/* ======================================
   GET OR CREATE CONVERSATION (OPTIMIZED)
====================================== */
export const getOrCreateConversation = async (user1: string, user2: string) => {
  if (!user1 || !user2) throw new Error("Thiếu thông tin người dùng");

  // 1. tìm conversation tồn tại
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(user1_id.eq.${user1},user2_id.eq.${user2}),and(user1_id.eq.${user2},user2_id.eq.${user1})`,
    )
    .maybeSingle();

  if (findError) {
    console.error("Find conversation error:", findError);
  }

  if (existing?.id) return existing.id;

  // 2. tạo conversation (FIX HERE)
  const { data: convo, error: createError } = await supabase
    .from("conversations")
    .insert({
      user1_id: user1,
      user2_id: user2,
    })
    .select()
    .single();

  if (createError) {
    console.error("Create conversation error:", createError);
    throw new Error(createError.message || "Lỗi tạo cuộc trò chuyện");
  }

  // Thêm cả 2 vào bảng thành viên để đồng bộ với cơ chế tải danh sách mới
  await supabase.from("conversation_participants").insert([
    { conversation_id: convo.id, user_id: user1 },
    { conversation_id: convo.id, user_id: user2 },
  ]);

  return convo.id;
};

/* ======================================
   GET MESSAGES (WITH USER INFO)
====================================== */
export const getMessages = async (conversationId: string) => {
  if (!conversationId) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id,
      content,
      created_at,
      sender_id,
      is_read,
      image_url,
      image_urls,
      file_url,
      file_name,
      file_type,
      file_size,
      reply_to_id,
      users:sender_id (
        id,
        name,
        avatar_url
      )
    `,
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getMessages error:", error.message || error);
    return [];
  }

  return data || [];
};

/* ======================================
   SEND MESSAGE (FAST + NO REFETCH)
====================================== */
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  content: string,
  imageUrl: string | null = null,
  imageUrls: string[] | null = null,
  fileUrl: string | null = null,
  fileName: string | null = null,
  fileType: string | null = null,
  fileSize: number | null = null,
  replyToId: string | null = null,
) => {
  if (
    !conversationId ||
    !senderId ||
    (!content && !imageUrl && !imageUrls && !fileUrl)
  ) {
    throw new Error("Thiếu thông tin");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert([
      {
        conversation_id: conversationId,
        sender_id: senderId,
        content: content,
        image_url: imageUrl,
        image_urls: imageUrls,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        reply_to_id: replyToId,
      },
    ])
    .select("*, users!messages_sender_id_fkey(id, name, avatar_url)")
    .single();

  if (error) {
    console.error("sendMessage SUPABASE ERROR:", error);
    throw error;
  }

  // Update last_message
  await supabase
    .from("conversations")
    .update({
      last_message:
        content ||
        (imageUrls?.length && imageUrls.length > 1
          ? `Đã gửi ${imageUrls.length} ảnh`
          : imageUrl
            ? "Đã gửi một ảnh"
            : fileUrl
              ? "Đã gửi một tệp"
              : ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return data;
};

/* ======================================
   CREATE GROUP CHAT
====================================== */
export const createGroupChat = async (
  adminId: string,
  memberIds: string[],
  groupName: string,
  groupAvatar: string | null = null,
) => {
  // 1. Tạo một conversation mới đánh dấu là Nhóm
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({
      is_group: true,
      group_name: groupName,
      group_avatar: groupAvatar,
      admin_id: adminId,
    })
    .select()
    .single();

  if (convError) {
    console.error("Create group error:", convError);
    throw new Error(convError.message);
  }

  // 2. Gom Admin và tất cả các Members lại thành 1 mảng
  const allParticipants = [adminId, ...memberIds];
  const participantsData = allParticipants.map((userId) => ({
    conversation_id: conv.id,
    user_id: userId,
  }));

  // 3. Thêm tất cả vào bảng conversation_participants
  const { error: partError } = await supabase
    .from("conversation_participants")
    .insert(participantsData);

  if (partError) {
    console.error("Add participants error:", partError);
    throw new Error(partError.message);
  }

  return conv.id; // Trả về ID của nhóm chat vừa tạo
};

/* ======================================
   GET GROUP MEMBERS
====================================== */
export const getConversationMembers = async (conversationId: string) => {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(
      `
      user_id,
      users:user_id (id, name, avatar_url)
    `,
    )
    .eq("conversation_id", conversationId);

  if (error) throw new Error(error.message || "Lỗi tải danh sách thành viên");
  return data.map((d: any) => d.users);
};

/* ======================================
   UPDATE GROUP NAME
====================================== */
export const updateGroupName = async (
  conversationId: string,
  name: string,
  avatar_url?: string | null,
) => {
  const payload: any = { group_name: name };
  if (avatar_url !== undefined) payload.group_avatar = avatar_url;

  const { data, error } = await supabase
    .from("conversations")
    .update(payload)
    .eq("id", conversationId)
    .select()
    .single();

  if (error) throw new Error(error.message || "Lỗi cập nhật tên nhóm");
  return data;
};

/* ======================================
   DELETE CONVERSATION
====================================== */
export const deleteConversation = async (conversationId: string) => {
  // Khi xóa conversation, Supabase (với ON DELETE CASCADE) sẽ tự động xóa tin nhắn và thành viên
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId);
  if (error) throw new Error(error.message || "Lỗi xóa cuộc trò chuyện");
  return true;
};

/* ======================================
   DELETE MESSAGE (THU HỒI TIN NHẮN)
====================================== */
export const deleteMessage = async (messageId: string) => {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId);
  if (error) throw new Error(error.message || "Lỗi thu hồi tin nhắn");
  return true;
};

/* ======================================
   SET NICKNAME (ĐỔI TÊN GỢI NHỚ)
====================================== */
export const setNickname = async (
  conversationId: string,
  userId: string,
  targetId: string,
  nickname: string,
) => {
  // Dùng upsert: Cập nhật nếu đã có, thêm mới nếu chưa có (Tránh lỗi Duplicate Unique)
  const { data, error } = await supabase
    .from("nicknames")
    .upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        target_id: targetId,
        nickname: nickname.trim(),
      },
      { onConflict: "conversation_id,user_id,target_id" },
    )
    .select();

  if (error) throw new Error(error.message || "Lỗi đổi tên gợi nhớ");
  return data;
};

/* ======================================
   BLOCK USER (CHẶN NGƯỜI DÙNG)
====================================== */
export const blockUser = async (blockerId: string, blockedId: string) => {
  const { error } = await supabase
    .from("blocked_users")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw new Error(error.message || "Lỗi chặn người dùng");
  return true;
};

/* ======================================
   GET BLOCKED USERS (LẤY DANH SÁCH CHẶN)
====================================== */
export const getBlockedUsers = async (userId: string) => {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", userId);
  if (error) throw new Error(error.message || "Lỗi tải danh sách chặn");
  if (!data || data.length === 0) return [];

  const ids = data.map((d) => d.blocked_id);
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, avatar_url")
    .in("id", ids);
  if (usersError) throw new Error(usersError.message || "Lỗi tải người dùng");
  return users || [];
};

/* ======================================
   UNBLOCK USER (BỎ CHẶN)
====================================== */
export const unblockUser = async (blockerId: string, blockedId: string) => {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .match({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw new Error(error.message || "Lỗi bỏ chặn");
  return true;
};

/* ======================================
   CALL RECORDS
====================================== */
export const createCallRecord = async (
  callerId: string,
  receiverId: string,
  roomId: string,
) => {
  const { data, error } = await supabase
    .from("calls")
    .insert({
      caller_id: callerId,
      receiver_id: receiverId,
      room_id: roomId,
      status: "ringing",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const updateCallRecord = async (callId: string, status: string) => {
  const updates: any = { status };
  if (status === "accepted") updates.started_at = new Date().toISOString();
  if (status === "ended" || status === "rejected")
    updates.ended_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("calls")
    .update(updates)
    .eq("id", callId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};
