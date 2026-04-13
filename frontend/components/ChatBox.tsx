"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Send, X, ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
} from "@/lib/chatApi";

interface ChatBoxProps {
  userId: string;
}

export default function ChatBox({ userId }: ChatBoxProps) {
  const [targetUser, setTargetUser] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ================= SMOOTH SCROLL (FIX LAG) =================
  useEffect(() => {
    if (!scrollRef.current) return;

    requestAnimationFrame(() => {
      scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
    });
  }, [messages.length]);

  // ================= REALTIME (FIX DUPLICATE + STABLE) =================
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new;

            // ❌ tránh duplicate
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // ================= LOAD CONVERSATIONS (OPTIMIZED) =================
  const loadConversations = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("updated_at", { ascending: false })
      .limit(20); // 🔥 giảm load

    if (!data) return;

    const enriched = await Promise.all(
      data.map(async (c) => {
        const otherId = c.user1_id === userId ? c.user2_id : c.user1_id;

        const { data: user } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", otherId)
          .maybeSingle();

        return { ...c, otherUser: user };
      }),
    );

    setConversations(enriched);
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ================= SEARCH (DEBOUNCE FIXED) =================
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!userId) return;
      if (search.length < 2) return setResults([]);

      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .neq("id", userId)
        .ilike("name", `%${search}%`)
        .limit(5);

      setResults(data || []);
    }, 300);

    return () => clearTimeout(t);
  }, [search, userId]);

  // ================= OPEN CHAT =================
  const handleOpenChat = async (user: any) => {
    if (!userId || !user?.id) return;

    setLoading(true);

    try {
      const id = await getOrCreateConversation(userId, user.id);

      setConversationId(id);
      setTargetUser(user);

      const msgs = await getMessages(id);
      setMessages(msgs || []);
    } catch (err) {
      console.error("open chat error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExisting = async (c: any) => {
    if (!c?.id) return;

    setTargetUser(c.otherUser);
    setConversationId(c.id);

    const msgs = await getMessages(c.id);
    setMessages(msgs || []);
  };

  // ================= SEND MESSAGE (FIX LAG + OPTIMISTIC UI) =================
  const handleSend = async () => {
    if (!text.trim() || !conversationId || !userId) return;

    const msgText = text.trim();
    setText("");

    // 🔥 OPTIMISTIC UPDATE (GIÚP MƯỢT)
    const tempMsg = {
      id: crypto.randomUUID(),
      sender_id: userId,
      content: msgText,
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      const msg = await sendMessage(conversationId, userId, msgText);

      // replace temp
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? msg : m)));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-[380px] h-[550px] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden relative">
      {/* HEADER */}
      <div className="p-4 border-b flex items-center justify-between">
        {targetUser ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTargetUser(null);
                setConversationId(null);
                setMessages([]);
              }}
            >
              <ChevronLeft size={20} />
            </button>

            <img
              src={targetUser?.avatar_url}
              className="w-8 h-8 rounded-full"
            />
            <span className="text-sm font-semibold">{targetUser?.name}</span>
          </div>
        ) : (
          <span className="font-bold">Tin nhắn</span>
        )}

        <X size={18} />
      </div>

      {/* BODY */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {!targetUser ? (
          <>
            <div className="flex items-center gap-2 border p-2 rounded-xl">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 outline-none text-sm"
                placeholder="Tìm người dùng..."
              />
            </div>

            {results.map((u) => (
              <div
                key={u.id}
                onClick={() => handleOpenChat(u)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
              >
                <img src={u.avatar_url} className="w-8 h-8 rounded-full" />
                <span>{u.name}</span>
              </div>
            ))}

            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => handleOpenExisting(c)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
              >
                <img
                  src={c.otherUser?.avatar_url}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <p className="text-sm font-semibold">{c.otherUser?.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.last_message || "Bắt đầu chat"}
                  </p>
                </div>
              </div>
            ))}
          </>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-3 py-2 rounded-2xl text-sm max-w-[75%]
                ${m.sender_id === userId ? "bg-blue-500 text-white" : "bg-gray-200"}
              `}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* INPUT */}
      {targetUser && (
        <div className="p-3 border-t flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 border rounded-xl px-3 py-2 text-sm"
            placeholder="Nhập tin nhắn..."
          />
          <button
            onClick={handleSend}
            className="bg-blue-500 text-white px-3 rounded-xl"
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}
    </div>
  );
}
