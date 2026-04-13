"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Send, User, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
} from "@/lib/chatApi";

export default function ChatBox({ userId }: { userId: string }) {
  const [targetUser, setTargetUser] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ================= AUTO SCROLL =================
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ================= LOAD CONVERSATIONS =================
  const loadConversations = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (!data) return;

    const enriched = await Promise.all(
      data.map(async (c) => {
        const otherUserId = c.user1_id === userId ? c.user2_id : c.user1_id;

        const { data: user } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", otherUserId)
          .maybeSingle();

        return {
          ...c,
          otherUser: user || {
            id: otherUserId,
            name: "Unknown user",
            avatar_url: null,
          },
        };
      }),
    );

    setConversations(enriched);
  };

  useEffect(() => {
    loadConversations();
  }, [userId]);

  // ================= SEARCH USER =================
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .neq("id", userId)
        .ilike("name", `%${searchQuery}%`)
        .limit(5);

      setSearchResults(data || []);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, userId]);

  // ================= SELECT USER =================
  const selectUser = async (user: any) => {
    if (loadingChat) return;
    if (!user?.id) return;

    setLoadingChat(true);

    try {
      const conv = await getOrCreateConversation(userId, user.id);

      const id = conv?.conversationId || conv?.id;

      if (!id) return;

      setConversationId(id);
      setTargetUser(user);

      const msgs = await getMessages(id);
      setMessages(msgs);
    } finally {
      setLoadingChat(false);
    }
  };

  // ================= SEND MESSAGE =================
  const handleSend = async () => {
    if (!text.trim() || !conversationId) return;

    const content = text;

    await sendMessage(conversationId, userId, content);

    setMessages((prev) => [
      ...prev,
      {
        sender_id: userId,
        content,
      },
    ]);

    setText("");

    await supabase
      .from("conversations")
      .update({
        last_message: content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    loadConversations();
  };

  // ================= OPEN CONVERSATION =================
  const openConversation = async (c: any) => {
    const otherUser = c.otherUser;

    setTargetUser(otherUser);
    setConversationId(c.id);

    const msgs = await getMessages(c.id);
    setMessages(msgs);
  };

  // ================= UI =================
  return (
    <div className="flex flex-col h-full bg-white">
      {/* HEADER */}
      <div className="p-3 border-b">
        {!targetUser ? (
          <div>
            <div className="flex items-center bg-gray-100 rounded-full px-3 py-1.5">
              <Search size={16} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm người..."
                className="bg-transparent outline-none text-sm w-full"
              />
            </div>

            {searchResults.map((u) => (
              <div
                key={u.id}
                onClick={() => selectUser(u)}
                className="flex items-center gap-3 p-2 cursor-pointer"
              >
                <img src={u.avatar_url} className="w-8 h-8 rounded-full" />
                <span>{u.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex justify-between">
            <div className="flex gap-3">
              <img
                src={targetUser.avatar_url}
                className="w-8 h-8 rounded-full"
              />
              <p className="font-bold">{targetUser.name}</p>
            </div>

            <button
              onClick={() => {
                setTargetUser(null);
                setConversationId(null);
                setMessages([]);
              }}
            >
              <X />
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {!targetUser ? (
          conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <User size={40} />
              <p>Chưa có cuộc trò chuyện</p>
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => openConversation(c)}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
              >
                <img
                  src={c.otherUser.avatar_url}
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <p className="font-medium">{c.otherUser.name}</p>
                  <p className="text-xs text-gray-400">{c.last_message}</p>
                </div>
              </div>
            ))
          )
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.sender_id === userId ? "justify-end" : "justify-start"
              }`}
            >
              <div className="px-3 py-2 rounded bg-gray-100">{m.content}</div>
            </div>
          ))
        )}
      </div>

      {/* INPUT */}
      {targetUser && (
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
              placeholder="Nhắn tin..."
            />

            <button
              onClick={handleSend}
              className="bg-blue-500 text-white px-4 rounded"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
