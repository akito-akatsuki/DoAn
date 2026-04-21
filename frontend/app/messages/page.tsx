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

  const [isTyping, setIsTyping] = useState(false);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef(0);
  const receiveTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ================= LOAD USER =================
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          const { data: dbUser } = await supabase
            .from("users")
            .select("*")
            .eq("id", data.user.id)
            .single();
          setUser({ ...data.user, ...dbUser });
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin user ở Messages:", err);
      }
    };
    loadUser();
  }, []);

  // ================= SMOOTH SCROLL =================
  useEffect(() => {
    if (!scrollRef.current) return;
    requestAnimationFrame(() => {
      scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
    });
  }, [messages.length, isTyping]);

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
      .channel(`chat_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as any;
            if (newMsg.conversation_id === conversationId) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new as any;
            if (updatedMsg.conversation_id === conversationId) {
              setMessages((prev) =>
                prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)),
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // ================= BROADCAST (TYPING INDICATOR) =================
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const typingChannel = supabase.channel(`typing_${conversationId}`);
    typingChannelRef.current = typingChannel;

    typingChannel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { isTyping: remoteIsTyping, senderId } = payload.payload;
        if (senderId !== user.id) {
          setIsTyping(remoteIsTyping);
          if (receiveTypingTimeoutRef.current)
            clearTimeout(receiveTypingTimeoutRef.current);
          if (remoteIsTyping) {
            receiveTypingTimeoutRef.current = setTimeout(
              () => setIsTyping(false),
              3000,
            );
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, user?.id]);

  // ================= READ RECEIPTS =================
  useEffect(() => {
    if (!conversationId || !user?.id || messages.length === 0) return;

    const unreadMsgs = messages.filter(
      (m) => m.sender_id !== user.id && !m.is_read,
    );

    if (unreadMsgs.length > 0) {
      const ids = unreadMsgs.map((m) => m.id);
      supabase.from("messages").update({ is_read: true }).in("id", ids).then();
      setMessages((prev) =>
        prev.map((m) => (ids.includes(m.id) ? { ...m, is_read: true } : m)),
      );
    }
  }, [messages, conversationId, user?.id]);

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

      let dbQuery = supabase
        .from("users")
        .select("id, name, avatar_url")
        .neq("id", user.id);

      const words = search.trim().split(/\s+/);
      words.forEach((word) => {
        dbQuery = dbQuery.ilike("name", `%${word}%`);
      });

      const { data } = await dbQuery.limit(5);

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

    // Tắt trạng thái typing ngay khi vừa gửi tin nhắn
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { isTyping: false, senderId: user?.id },
      });
    }
    lastTypingTimeRef.current = 0;
  };

  return (
    <div className="h-screen flex flex-col text-gray-900 dark:text-gray-100 transition-colors duration-500 overflow-hidden bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[935px] w-full mx-auto flex-1 pt-[76px] px-4 pb-24 md:pb-6 flex gap-4 overflow-hidden">
        {/* CỘT TRÁI: DANH SÁCH CHAT */}
        <div
          className={`w-full md:w-[350px] border border-gray-200 dark:border-neutral-800 shadow-sm dark:shadow-black/30 rounded-xl flex flex-col h-full transition-all duration-500 bg-white dark:bg-[#262626] ${targetUser ? "hidden md:flex" : "flex"}`}
        >
          <div className="p-4 border-b border-gray-200 dark:border-neutral-800 font-bold text-lg flex items-center">
            {user?.name || user?.user_metadata?.name || "Tin nhắn"}
          </div>

          <div className="p-3">
            <div className="flex items-center gap-2 border border-gray-200 dark:border-neutral-700 shadow-inner focus-within:ring-1 focus-within:ring-blue-500 transition-all p-2 rounded-xl bg-gray-50 dark:bg-[#333333] focus-within:bg-white dark:focus-within:bg-[#262626]">
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
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-[#333333]"
              >
                <img
                  src={
                    u.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                  }
                  className="w-12 h-12 rounded-full border border-gray-200 dark:border-neutral-700 shadow-sm object-cover"
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
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-[#333333] ${
                    conversationId === c.id
                      ? "bg-gray-200 dark:bg-[#3f3f3f]"
                      : ""
                  }`}
                >
                  <img
                    src={
                      c.otherUser?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${c.otherUser?.id}`
                    }
                    className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-neutral-700 shadow-sm flex-shrink-0"
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
          className={`flex-1 border border-gray-200 dark:border-neutral-800 shadow-sm dark:shadow-black/30 rounded-xl flex flex-col h-full relative transition-all duration-500 bg-white dark:bg-[#262626] ${!targetUser ? "hidden md:flex" : "flex"}`}
        >
          {!targetUser ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
              <div className="w-24 h-24 border-2 border-muted-foreground rounded-full flex items-center justify-center">
                <Send size={48} className="text-muted-foreground ml-2" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Tin nhắn của bạn
              </h2>
              <p>Chọn một đoạn chat để bắt đầu nhắn tin.</p>
            </div>
          ) : (
            <>
              {/* HEADER CHAT */}
              <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-3 rounded-t-xl shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-black/20">
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
                  className="w-11 h-11 rounded-full border border-gray-200 dark:border-neutral-700 shadow-sm object-cover"
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
                {messages.map((m, index) => {
                  const isLastMessage = index === messages.length - 1;
                  return (
                    <div key={m.id} className="flex flex-col">
                      <div
                        className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`px-4 py-2 text-[15px] max-w-[70%] break-words ${
                            m.sender_id === user?.id
                              ? "bg-[#0095F6] text-white rounded-2xl rounded-br-sm shadow-sm"
                              : "rounded-2xl rounded-bl-sm border bg-gray-100 dark:bg-[#333333] text-gray-900 dark:text-gray-100 border-transparent dark:border-neutral-700 shadow-sm"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                      {m.sender_id === user?.id &&
                        m.is_read &&
                        isLastMessage && (
                          <span className="text-[11px] text-muted-foreground text-right mt-1 pr-1">
                            Đã xem
                          </span>
                        )}
                    </div>
                  );
                })}
                {isTyping && (
                  <div className="text-sm text-muted-foreground italic ml-2 mt-1">
                    {targetUser?.name} đang soạn tin...
                  </div>
                )}
              </div>

              {/* INPUT CHAT */}
              <div className="p-4 border-t border-gray-200 dark:border-neutral-800 rounded-b-xl flex gap-3 shrink-0 transition-colors duration-500 bg-white dark:bg-[#262626] shadow-[0_-2px_10px_rgba(0,0,0,0.02)] dark:shadow-black/20">
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (typingChannelRef.current) {
                      if (e.target.value === "") {
                        if (typingTimeoutRef.current)
                          clearTimeout(typingTimeoutRef.current);
                        typingChannelRef.current.send({
                          type: "broadcast",
                          event: "typing",
                          payload: { isTyping: false, senderId: user?.id },
                        });
                        lastTypingTimeRef.current = 0;
                      } else {
                        const now = Date.now();
                        if (now - lastTypingTimeRef.current > 1000) {
                          typingChannelRef.current.send({
                            type: "broadcast",
                            event: "typing",
                            payload: { isTyping: true, senderId: user?.id },
                          });
                          lastTypingTimeRef.current = now;
                        }
                        if (typingTimeoutRef.current)
                          clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = setTimeout(() => {
                          typingChannelRef.current?.send({
                            type: "broadcast",
                            event: "typing",
                            payload: { isTyping: false, senderId: user?.id },
                          });
                          lastTypingTimeRef.current = 0;
                        }, 2000);
                      }
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 border border-gray-200 dark:border-neutral-700 shadow-inner transition-colors outline-none rounded-full px-4 py-2.5 text-[15px] bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
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
                <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl bg-white/60 dark:bg-[#262626]/60">
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
