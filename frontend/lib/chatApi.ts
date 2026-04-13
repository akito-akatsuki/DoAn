import { supabase } from "./supabaseClient";

/* ==============================
   GET OR CREATE CONVERSATION
============================== */
export const getOrCreateConversation = async (user1: string, user2: string) => {
  if (!user1 || !user2) throw new Error("Missing users");

  // tìm conversation chung
  const { data, error } = await supabase
    .from("conversation_members")
    .select("conversation_id, user_id");

  if (error) {
    console.error("conversation_members error:", error);
    throw error;
  }

  const convMap = new Map<string, Set<string>>();

  data?.forEach((row) => {
    if (!convMap.has(row.conversation_id)) {
      convMap.set(row.conversation_id, new Set());
    }
    convMap.get(row.conversation_id)!.add(row.user_id);
  });

  for (const [convId, members] of convMap.entries()) {
    if (members.has(user1) && members.has(user2)) {
      return convId;
    }
  }

  // tạo conversation mới
  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .insert({})
    .select()
    .single();

  if (convoError) throw convoError;

  // add members
  const { error: memberError } = await supabase
    .from("conversation_members")
    .insert([
      { conversation_id: convo.id, user_id: user1 },
      { conversation_id: convo.id, user_id: user2 },
    ]);

  if (memberError) throw memberError;

  return convo.id;
};

/* ==============================
   GET MESSAGES
============================== */
export const getMessages = async (conversationId: string) => {
  if (!conversationId) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*, users(*)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getMessages error:", error);
    return [];
  }

  return data || [];
};

/* ==============================
   SEND MESSAGE
============================== */
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
    .insert([
      {
        conversation_id: conversationId,
        sender_id: senderId,
        content,
      },
    ])
    .select("*, users(*)")
    .single();

  if (error) throw error;

  return data;
};
