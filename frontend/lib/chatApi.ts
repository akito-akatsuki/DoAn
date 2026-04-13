const API_URL = "http://localhost:5000";

/**
 * CREATE OR GET CONVERSATION
 */
export const getOrCreateConversation = async (user1: string, user2: string) => {
  if (!user1 || !user2) {
    throw new Error("Missing user IDs");
  }

  const res = await fetch(`${API_URL}/chat/conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user1, user2 }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
};

/**
 * GET MESSAGES
 */
export const getMessages = async (conversationId: string) => {
  if (!conversationId) return [];

  const res = await fetch(`${API_URL}/chat/messages/${conversationId}`);

  const data = await res.json();

  if (!res.ok) return [];

  return Array.isArray(data) ? data : [];
};

/**
 * SEND MESSAGE
 */
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  content: string,
) => {
  if (!conversationId || !senderId || !content) {
    throw new Error("Missing fields");
  }

  const res = await fetch(`${API_URL}/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId,
      senderId,
      content,
    }),
  });

  const data = await res.json();

  if (!res.ok) throw data;

  return data;
};
