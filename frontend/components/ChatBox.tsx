"use client";

import { useEffect, useRef, useState } from "react";
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

  // 1. Tự động cuộn xuống cuối
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 2. Lắng nghe tin nhắn Realtime
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
            // Tránh trùng lặp tin nhắn do chính mình gửi (vì đã set local state trước đó)
            const isExist = prev.some((m) => m.id === payload.new.id);
            if (isExist) return prev;
            return [...prev, payload.new];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // 3. Load danh sách các cuộc trò chuyện cũ
  const loadConversations = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("updated_at", { ascending: false });

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
  };

  useEffect(() => {
    loadConversations();
  }, [userId]);

  // 4. Tìm kiếm người dùng
  useEffect(() => {
    const t = setTimeout(async () => {
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
  }, [search]);

  // 5. Mở cuộc trò chuyện
  const handleOpenChat = async (user: any) => {
    setLoading(true);
    const id = await getOrCreateConversation(userId, user.id);
    setConversationId(id);
    setTargetUser(user);
    const msgs = await getMessages(id);
    setMessages(msgs);
    setSearch("");
    setResults([]);
    setLoading(false);
  };

  const handleOpenExisting = async (c: any) => {
    setTargetUser(c.otherUser);
    setConversationId(c.id);
    const msgs = await getMessages(c.id);
    setMessages(msgs);
  };

  // 6. Gửi tin nhắn
  const handleSend = async () => {
    if (!text.trim() || !conversationId) return;

    const currentText = text.trim();
    setText(""); // Chỉ xóa ô nhập liệu

    try {
      // Không setMessages ở đây nữa
      await sendMessage(conversationId, userId, currentText);
      loadConversations();
    } catch (error) {
      console.error("Lỗi gửi tin:", error);
    }
  };

  return (
    <div className="w-[380px] h-[550px] flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
      {/* HEADER */}
      <div className="p-4 border-b bg-white flex items-center justify-between min-h-[64px]">
        {targetUser ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setTargetUser(null);
                setConversationId(null);
              }}
              className="p-1 hover:bg-gray-100 rounded-full transition"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <img
                  src={targetUser.avatar_url}
                  className="w-8 h-8 rounded-full object-cover border"
                  alt="avatar"
                />
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white rounded-full"></div>
              </div>
              <span className="font-semibold text-sm truncate max-w-[150px]">
                {targetUser.name}
              </span>
            </div>
          </div>
        ) : (
          <h2 className="font-bold text-lg">Tin nhắn</h2>
        )}
        <X
          size={20}
          className="text-gray-400 cursor-pointer hover:text-black transition"
        />
      </div>

      {/* BODY */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50/50"
      >
        {!targetUser ? (
          <div className="flex flex-col gap-2">
            {/* Thanh tìm kiếm */}
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl mb-2">
              <Search size={16} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm w-full"
                placeholder="Tìm kiếm người dùng..."
              />
            </div>

            {/* Kết quả search */}
            {results.map((u) => (
              <div
                key={u.id}
                onClick={() => handleOpenChat(u)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm cursor-pointer transition border border-transparent hover:border-gray-100"
              >
                <img
                  src={u.avatar_url}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <span className="text-sm font-medium">{u.name}</span>
              </div>
            ))}

            {results.length === 0 && search.length > 0 && (
              <p className="text-center text-xs text-gray-400 py-4">
                Không tìm thấy người dùng
              </p>
            )}

            {/* Danh sách chat cũ */}
            <div className="mt-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                Gần đây
              </p>
              {conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleOpenExisting(c)}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white hover:shadow-sm cursor-pointer transition mb-1 group"
                >
                  <img
                    src={c.otherUser?.avatar_url}
                    className="w-12 h-12 rounded-full border shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold truncate">
                        {c.otherUser?.name}
                      </p>
                      <span className="text-[10px] text-gray-400">
                        Vừa xong
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {c.last_message || "Bắt đầu trò chuyện ngay"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Khung chat chi tiết */
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex w-full ${m.sender_id === userId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 text-sm shadow-sm ${
                  m.sender_id === userId
                    ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm"
                    : "bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* INPUT AREA */}
      {targetUser && (
        <div className="p-4 bg-white border-t">
          <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all border border-transparent focus-within:border-blue-200">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              className="flex-1 bg-transparent py-2 text-sm outline-none"
              placeholder="Aa"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="p-1.5 text-blue-600 disabled:text-gray-300 hover:bg-blue-50 rounded-full transition"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" />
        </div>
      )}
    </div>
  );
}
