import { supabase } from "./supabaseClient";

/* ======================================
   GET OR CREATE CONVERSATION (OPTIMIZED)
====================================== */
export const getOrCreateConversation = async (user1: string, user2: string) => {
  if (!user1 || !user2) throw new Error("Missing users");

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
    throw createError;
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
    console.error("getMessages error:", error);
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
) => {
  if (!conversationId || !senderId || !content) {
    throw new Error("Missing fields");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    })
    .select("*")
    .single();

  if (error) {
    console.error("sendMessage SUPABASE ERROR:", error);
    throw error;
  }

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

  if (error) throw error;
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

  if (error) throw error;
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
  if (error) throw error;
  return true;
};
