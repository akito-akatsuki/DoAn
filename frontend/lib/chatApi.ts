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
