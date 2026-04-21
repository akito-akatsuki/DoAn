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
  onClose?: () => void;
}

export default function ChatBox({ userId, onClose }: ChatBoxProps) {
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

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // ================= ONLINE STATUS (PRESENCE) =================
  useEffect(() => {
    // Lấy state hiện tại nếu Navbar đã sync trước đó
    if ((window as any).currentOnlineUsers) {
      setOnlineUsers((window as any).currentOnlineUsers);
    }

    const handlePresenceSync = (e: any) => {
      setOnlineUsers(e.detail);
    };

    window.addEventListener(
      "presence_sync",
      handlePresenceSync as EventListener,
    );

    return () => {
      window.removeEventListener(
        "presence_sync",
        handlePresenceSync as EventListener,
      );
    };
  }, []);

  // ================= SMOOTH SCROLL (FIX LAG) =================
  useEffect(() => {
    if (!scrollRef.current) return;

    requestAnimationFrame(() => {
      scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
    });
  }, [messages.length, isTyping]);

  // ================= REALTIME + BROADCAST (MULTIPLEXING) =================
  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase
      .channel(`chat_${conversationId}`, {
        config: {
          broadcast: { ack: false },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
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
      .on("broadcast", { event: "typing" }, (payload) => {
        const { isTyping: remoteIsTyping, senderId } = payload.payload;
        if (senderId !== userId) {
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          typingChannelRef.current = channel;
        }
      });

    // Gán tạm thời ngay lập tức để người dùng gõ nhanh không bị lỗi
    typingChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [conversationId, userId]);

  // ================= READ RECEIPTS (ĐÃ XEM) =================
  useEffect(() => {
    if (!conversationId || !userId || messages.length === 0) return;

    const unreadMsgs = messages.filter(
      (m) => m.sender_id !== userId && !m.is_read,
    );

    if (unreadMsgs.length > 0) {
      const ids = unreadMsgs.map((m) => m.id);
      supabase.from("messages").update({ is_read: true }).in("id", ids).then();
      setMessages((prev) =>
        prev.map((m) => (ids.includes(m.id) ? { ...m, is_read: true } : m)),
      );
    }
  }, [messages, conversationId, userId]);

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

        // Lấy trực tiếp tin nhắn mới nhất
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
            lastMsg.sender_id === userId
              ? `Bạn: ${lastMsg.content}`
              : lastMsg.content;
        }

        return { ...c, otherUser: user, display_last_message: displayTxt };
      }),
    );

    setConversations(enriched);
  }, [userId]);

  // ================= REALTIME DANH SÁCH CHAT BÊN NGOÀI =================
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`conversations_list_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Lắng nghe mọi cập nhật (thêm mới / update tin nhắn cuối)
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          const { user1_id, user2_id } = (payload.new ||
            payload.old ||
            {}) as any;
          // Nếu cuộc hội thoại được cập nhật thuộc về user này thì reload danh sách
          if (user1_id === userId || user2_id === userId) {
            loadConversations();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadConversations]);

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

    // Tắt trạng thái typing ngay khi vừa gửi tin nhắn
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { isTyping: false, senderId: userId },
      });
    }
    lastTypingTimeRef.current = 0;
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100 overflow-hidden relative transition-colors duration-500">
      {/* HEADER */}
      <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-black/20">
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

            <div className="relative">
              <img
                src={targetUser?.avatar_url}
                className="w-8 h-8 rounded-full"
              />
              {onlineUsers.has(targetUser.id) && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">
                {targetUser?.name}
              </span>
              {onlineUsers.has(targetUser.id) ? (
                <span className="text-[10px] text-green-500 leading-tight">
                  Đang hoạt động
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Ngoại tuyến
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="font-bold">Tin nhắn</span>
        )}

        {onClose && (
          <X
            size={20}
            className="cursor-pointer text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            onClick={onClose}
          />
        )}
      </div>

      {/* BODY */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {!targetUser ? (
          <>
            <div className="flex items-center gap-2 border border-gray-200 dark:border-neutral-700 shadow-inner bg-gray-50 dark:bg-[#333333] focus-within:bg-white dark:focus-within:bg-[#262626] focus-within:ring-1 focus-within:ring-blue-500 transition-all p-2 rounded-xl">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 outline-none text-sm bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400"
                placeholder="Tìm người dùng..."
              />
            </div>

            {results.map((u) => (
              <div
                key={u.id}
                onClick={() => handleOpenChat(u)}
                className="flex items-center gap-2 p-2 hover:bg-secondary rounded cursor-pointer transition-colors"
              >
                <div className="relative">
                  <img src={u.avatar_url} className="w-8 h-8 rounded-full" />
                  {onlineUsers.has(u.id) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></span>
                  )}
                </div>
                <span>{u.name}</span>
              </div>
            ))}

            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => handleOpenExisting(c)}
                className="flex items-center gap-2 p-2 hover:bg-secondary rounded cursor-pointer transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={c.otherUser?.avatar_url}
                    className="w-10 h-10 rounded-full"
                  />
                  {onlineUsers.has(c.otherUser?.id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {c.otherUser?.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.display_last_message || "Bắt đầu chat"}
                  </p>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {messages.map((m, index) => {
              const isLastMessage = index === messages.length - 1;
              return (
                <div key={m.id} className="flex flex-col">
                  <div
                    className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm max-w-[75%] break-words
                ${m.sender_id === userId ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 dark:bg-[#333333] border border-transparent dark:border-neutral-700 text-gray-900 dark:text-gray-100 shadow-sm"}
              `}
                    >
                      {m.content}
                    </div>
                  </div>
                  {m.sender_id === userId && m.is_read && isLastMessage && (
                    <span className="text-[10px] text-muted-foreground text-right mt-1 pr-1">
                      Đã xem
                    </span>
                  )}
                </div>
              );
            })}
            {isTyping && (
              <div className="text-xs text-muted-foreground italic ml-2 mt-1">
                {targetUser?.name} đang soạn tin...
              </div>
            )}
          </>
        )}
      </div>

      {/* INPUT */}
      {targetUser && (
        <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#262626] flex gap-2 transition-colors duration-500 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] dark:shadow-black/20">
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // Bắn sự kiện đang gõ phím
              if (typingChannelRef.current) {
                if (e.target.value === "") {
                  if (typingTimeoutRef.current)
                    clearTimeout(typingTimeoutRef.current);
                  typingChannelRef.current.send({
                    type: "broadcast",
                    event: "typing",
                    payload: { isTyping: false, senderId: userId },
                  });
                  lastTypingTimeRef.current = 0;
                } else {
                  const now = Date.now();
                  if (now - lastTypingTimeRef.current > 1000) {
                    typingChannelRef.current.send({
                      type: "broadcast",
                      event: "typing",
                      payload: { isTyping: true, senderId: userId },
                    });
                    lastTypingTimeRef.current = now;
                  }
                  if (typingTimeoutRef.current)
                    clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => {
                    typingChannelRef.current?.send({
                      type: "broadcast",
                      event: "typing",
                      payload: { isTyping: false, senderId: userId },
                    });
                    lastTypingTimeRef.current = 0;
                  }, 2000);
                }
              }
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 border border-gray-200 dark:border-neutral-700 shadow-inner bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] text-gray-900 dark:text-gray-100 transition-colors outline-none rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400"
            placeholder="Nhập tin nhắn..."
          />
          <button
            onClick={handleSend}
            className="bg-blue-500 hover:bg-blue-600 transition-colors text-white px-3 rounded-xl"
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Loader2 className="animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
