"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import { Search, Send, ChevronLeft, Loader2 } from "lucide-react";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
} from "@/lib/chatApi";

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ================= LOAD USER =================
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    loadUser();
  }, []);

  // ================= SMOOTH SCROLL =================
  useEffect(() => {
    if (!scrollRef.current) return;
    requestAnimationFrame(() => {
      scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
    });
  }, [messages.length]);

  // ================= LOAD CONVERSATIONS =================
  const loadConversations = useCallback(async () => {
    if (!user?.id) return;

    // Lấy các cuộc trò chuyện và sắp xếp theo tin nhắn mới nhất
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!data) return;

    // Gắn thêm thông tin của user đối phương
    const enriched = await Promise.all(
      data.map(async (c) => {
        const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
        const { data: u } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", otherId)
          .maybeSingle();

        // Lấy trực tiếp tin nhắn mới nhất từ bảng messages
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, sender_id")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let displayTxt = c.last_message;
        if (lastMsg) {
          displayTxt =
            lastMsg.sender_id === user.id
              ? `Bạn: ${lastMsg.content}`
              : lastMsg.content;
        }

        return { ...c, otherUser: u, display_last_message: displayTxt };
      }),
    );

    setConversations(enriched);
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ================= REALTIME CHAT (Trong khung chat) =================
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat_page_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg.conversation_id === conversationId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // ================= REALTIME CONVERSATIONS (Bên menu trái) =================
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`conversations_page_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          const { user1_id, user2_id } = (payload.new ||
            payload.old ||
            {}) as any;
          // Nếu mình thuộc đoạn chat này thì tải lại danh sách để hiện tin nhắn mới lên đầu
          if (user1_id === user.id || user2_id === user.id) {
            loadConversations();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadConversations]);

  // ================= SEARCH =================
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!user?.id) return;
      if (search.length < 2) return setResults([]);

      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .neq("id", user.id)
        .ilike("name", `%${search}%`)
        .limit(5);

      setResults(data || []);
    }, 300);

    return () => clearTimeout(t);
  }, [search, user?.id]);

  // ================= MỞ CHAT MỚI TỪ TÌM KIẾM =================
  const handleOpenChat = async (target: any) => {
    if (!user?.id || !target?.id) return;

    setLoading(true);
    try {
      const id = await getOrCreateConversation(user.id, target.id);
      setConversationId(id);
      setTargetUser(target);
      setSearch("");
      setResults([]);

      const msgs = await getMessages(id);
      setMessages(msgs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ================= MỞ ĐOẠN CHAT CŨ =================
  const handleOpenExisting = async (c: any) => {
    if (!c?.id) return;

    setTargetUser(c.otherUser);
    setConversationId(c.id);

    const msgs = await getMessages(c.id);
    setMessages(msgs || []);
  };

  // ================= GỬI TIN NHẮN =================
  const handleSend = async () => {
    if (!text.trim() || !conversationId || !user?.id) return;

    const msgText = text.trim();
    setText(""); // Xóa input ngay lập tức

    const tempMsg = {
      id: crypto.randomUUID(),
      sender_id: user.id,
      content: msgText,
    };

    // Cập nhật UI tạm thời cho mượt
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const msg = await sendMessage(conversationId, user.id, msgText);
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? msg : m)));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-500 overflow-hidden">
      <Navbar user={user} />

      <main className="max-w-[935px] w-full mx-auto flex-1 pt-[76px] px-4 pb-24 md:pb-6 flex gap-4 overflow-hidden">
        {/* CỘT TRÁI: DANH SÁCH CHAT */}
        <div
          className={`w-full md:w-[350px] bg-secondary/10 border border-border rounded-xl flex flex-col h-full ${targetUser ? "hidden md:flex" : "flex"}`}
        >
          <div className="p-4 border-b border-border font-bold text-lg flex items-center">
            {user?.user_metadata?.name || "Tin nhắn"}
          </div>

          <div className="p-3">
            <div className="flex items-center gap-2 border border-border bg-secondary/50 focus-within:bg-background focus-within:ring-1 focus-within:ring-border transition-all p-2 rounded-xl">
              <Search size={16} className="text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 outline-none text-[15px] bg-transparent"
                placeholder="Tìm kiếm người dùng..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Hiển thị kết quả tìm kiếm nếu có */}
            {results.map((u) => (
              <div
                key={u.id}
                onClick={() => handleOpenChat(u)}
                className="flex items-center gap-3 p-3 hover:bg-secondary rounded-xl cursor-pointer transition-colors"
              >
                <img
                  src={
                    u.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                  }
                  className="w-12 h-12 rounded-full border border-border object-cover"
                />
                <span className="font-medium text-[15px]">{u.name}</span>
              </div>
            ))}

            {/* Không có tin nhắn */}
            {search.length === 0 && conversations.length === 0 && (
              <div className="text-center text-muted-foreground p-4 text-[15px]">
                Chưa có cuộc trò chuyện nào.
              </div>
            )}

            {/* Lịch sử trò chuyện */}
            {search.length === 0 &&
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleOpenExisting(c)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${conversationId === c.id ? "bg-secondary/80" : "hover:bg-secondary/40"}`}
                >
                  <img
                    src={
                      c.otherUser?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${c.otherUser?.id}`
                    }
                    className="w-14 h-14 rounded-full object-cover border border-border flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold truncate">
                      {c.otherUser?.name}
                    </p>
                    {/* Hiển thị tin nhắn mới nhất */}
                    <p
                      className={`text-[14px] truncate mt-0.5 ${c.display_last_message ? "text-muted-foreground" : "text-gray-400 italic"}`}
                    >
                      {c.display_last_message ||
                        "Hãy là người bắt đầu cuộc trò chuyện"}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* CỘT PHẢI: KHUNG CHAT CHI TIẾT */}
        <div
          className={`flex-1 bg-background border border-border rounded-xl flex flex-col h-full relative ${!targetUser ? "hidden md:flex" : "flex"}`}
        >
          {!targetUser ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
              <div className="w-24 h-24 border-2 border-muted-foreground rounded-full flex items-center justify-center">
                <Send size={48} className="text-muted-foreground ml-2" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Tin nhắn của bạn
              </h2>
              <p>Chọn một đoạn chat để bắt đầu nhắn tin.</p>
            </div>
          ) : (
            <>
              {/* HEADER CHAT */}
              <div className="p-4 border-b border-border flex items-center gap-3 bg-secondary/10 rounded-t-xl shrink-0">
                <button
                  className="md:hidden p-1 -ml-2"
                  onClick={() => {
                    setTargetUser(null);
                    setConversationId(null);
                    setMessages([]);
                  }}
                >
                  <ChevronLeft size={28} />
                </button>
                <img
                  src={
                    targetUser?.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${targetUser.id}`
                  }
                  className="w-11 h-11 rounded-full border border-border object-cover"
                />
                <span className="font-bold text-[16px]">
                  {targetUser?.name}
                </span>
              </div>

              {/* NỘI DUNG CHAT */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`px-4 py-2 text-[15px] max-w-[70%] break-words
                      ${m.sender_id === user?.id ? "bg-[#0095F6] text-white rounded-2xl rounded-br-sm" : "bg-secondary text-foreground border border-border rounded-2xl rounded-bl-sm"}
                    `}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* INPUT CHAT */}
              <div className="p-4 border-t border-border bg-background rounded-b-xl flex gap-3 shrink-0">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 border border-border bg-secondary/30 focus:bg-background transition-colors outline-none rounded-full px-4 py-2.5 text-[15px]"
                  placeholder="Nhắn tin..."
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="bg-[#0095F6] hover:bg-blue-600 disabled:opacity-50 transition-colors text-white px-5 rounded-full flex items-center justify-center font-semibold text-[15px]"
                >
                  Gửi
                </button>
              </div>

              {/* LOADING OVERLAY */}
              {loading && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
                  <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
