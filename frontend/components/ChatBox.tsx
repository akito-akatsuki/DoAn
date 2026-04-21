"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search,
  Send,
  X,
  ChevronLeft,
  Loader2,
  Users,
  Settings,
  Edit3,
  Trash2,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
  createGroupChat,
  getConversationMembers,
  updateGroupName,
  deleteConversation,
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

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);

  const [isTyping, setIsTyping] = useState(false);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef(0);
  const receiveTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // ================= SETTINGS STATES =================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<
    "menu" | "search" | "members" | "edit_name"
  >("menu");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupAvatar, setNewGroupAvatar] = useState<File | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

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

  // ================= LOAD FOLLOWS CHO TÍNH NĂNG KHÓA CHAT =================
  useEffect(() => {
    if (!userId) return;
    const fetchFollows = async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      setFollowedIds(new Set((data || []).map((f) => f.following_id)));
    };
    fetchFollows();
  }, [userId]);

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

    // Lấy danh sách ID các phòng chat (Bao gồm cả nhóm và 1-1) mà người dùng tham gia
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!parts || parts.length === 0) return setConversations([]);
    const convIds = parts.map((p) => p.conversation_id);

    const { data } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (!data) return;

    const enriched = await Promise.all(
      data.map(async (c) => {
        let otherUser;
        if (c.is_group) {
          otherUser = {
            id: c.id,
            name: c.group_name || "Nhóm chưa đặt tên",
            avatar_url:
              c.group_avatar ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${c.id}`,
            is_group: true,
          };
        } else {
          const otherId = c.user1_id === userId ? c.user2_id : c.user1_id;
          const { data: user } = await supabase
            .from("users")
            .select("id, name, avatar_url")
            .eq("id", otherId)
            .maybeSingle();
          otherUser = user;
        }

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

        return { ...c, otherUser: otherUser, display_last_message: displayTxt };
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
        () => {
          // Bất kỳ conversation nào bị update đều load lại
          loadConversations();
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

      // 1. Lấy danh sách ID những người mình ĐANG THEO DÕI
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      const followingIds = (follows || []).map((f) => f.following_id);

      // 2. Nếu ô tìm kiếm trống
      if (!search.trim()) {
        if (isCreatingGroup && followingIds.length > 0) {
          // Khi mở tạo nhóm, tự động hiển thị sẵn danh sách bạn bè
          const { data } = await supabase
            .from("users")
            .select("id, name, avatar_url")
            .in("id", followingIds)
            .limit(15);
          setResults(data || []);
        } else {
          setResults([]);
        }
        return;
      }

      // 3. Khi có từ khóa tìm kiếm (chỉ tìm trong những người đã theo dõi)
      if (followingIds.length === 0) {
        setResults([]);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .in("id", followingIds)
        .ilike("name", `%${search}%`)
        .limit(15);

      setResults(data || []);
    }, 300);

    return () => clearTimeout(t);
  }, [search, userId, isCreatingGroup]);

  // ================= CREATE GROUP =================
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Vui lòng nhập tên nhóm!");
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 thành viên!");
      return;
    }

    setLoading(true);
    try {
      const memberIds = selectedMembers.map((m) => m.id);
      const groupId = await createGroupChat(
        userId,
        memberIds,
        groupName.trim(),
      );

      setIsCreatingGroup(false);
      setGroupName("");
      setSelectedMembers([]);
      setSearch("");

      setConversationId(groupId);
      setTargetUser({
        id: groupId,
        name: groupName.trim(),
        avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${groupId}`,
        is_group: true,
      });

      const msgs = await getMessages(groupId);
      setMessages(msgs || []);
      loadConversations();
    } catch (err) {
      console.error("Lỗi tạo nhóm:", err);
      toast.error("Tạo nhóm thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // ================= OPEN CHAT =================
  const handleOpenChat = async (user: any) => {
    if (!userId || !user?.id) return;

    setLoading(true);

    try {
      const id = await getOrCreateConversation(userId, user.id);

      setConversationId(id);
      setTargetUser(user);
      setIsSettingsOpen(false); // Đóng cài đặt nếu đang mở

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
    setIsSettingsOpen(false); // Đóng cài đặt nếu đang mở

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

  // ================= SETTINGS HANDLERS =================
  const handleLoadMembers = async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      const members = await getConversationMembers(conversationId);
      setGroupMembers(members);
      setSettingsView("members");
    } catch (e) {
      toast.error("Lỗi tải thành viên");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!conversationId || !newGroupName.trim()) return;
    try {
      setLoading(true);
      let avatarUrl = undefined;

      if (newGroupAvatar) {
        const cleanName = newGroupAvatar.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `group_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(fileName, newGroupAvatar);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("posts")
            .getPublicUrl(fileName);
          avatarUrl = data.publicUrl;
        }
      }

      await updateGroupName(conversationId, newGroupName.trim(), avatarUrl);
      setTargetUser((prev: any) => ({
        ...prev,
        name: newGroupName.trim(),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      }));
      setSettingsView("menu");
      toast.success("Cập nhật nhóm thành công!");
      loadConversations();
    } catch (e) {
      toast.error("Lỗi cập nhật nhóm");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!conversationId) return;
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn xóa/rời khỏi cuộc trò chuyện này? Hành động này không thể hoàn tác.",
      )
    )
      return;
    try {
      setLoading(true);
      await deleteConversation(conversationId);
      setTargetUser(null);
      setConversationId(null);
      setMessages([]);
      setIsSettingsOpen(false);
      loadConversations();
      toast.success("Đã xóa cuộc trò chuyện");
    } catch (e) {
      toast.error("Lỗi xóa cuộc trò chuyện");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100 overflow-hidden relative transition-colors duration-500">
      {/* HEADER */}
      <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-black/20">
        {targetUser ? (
          <>
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => {
                  setTargetUser(null);
                  setConversationId(null);
                  setMessages([]);
                  setIsSettingsOpen(false);
                }}
              >
                <ChevronLeft size={20} />
              </button>

              <div className="relative">
                <img
                  src={targetUser?.avatar_url}
                  className="w-8 h-8 rounded-full"
                />
                {!targetUser.is_group && onlineUsers.has(targetUser.id) && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight">
                  {targetUser?.name}
                </span>
                {targetUser.is_group ? (
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Nhóm chat
                  </span>
                ) : onlineUsers.has(targetUser.id) ? (
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

            {/* GEAR ICON CÀI ĐẶT */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen);
                  setSettingsView("menu");
                  setChatSearchQuery("");
                }}
                className={`p-2 transition-colors rounded-full hover:bg-secondary ${isSettingsOpen ? "bg-secondary text-gray-900 dark:text-gray-100" : "text-muted-foreground"}`}
              >
                <Settings size={20} />
              </button>
            </div>
          </>
        ) : isCreatingGroup ? (
          <div className="flex items-center w-full justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsCreatingGroup(false);
                  setSelectedMembers([]);
                  setGroupName("");
                  setSearch("");
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="font-bold">Tạo nhóm mới</span>
            </div>
            <button
              onClick={handleCreateGroup}
              className="text-blue-500 font-semibold text-sm hover:text-blue-600"
            >
              Tạo
            </button>
          </div>
        ) : (
          <>
            <span className="font-bold">Tin nhắn</span>
            {onClose && (
              <X
                size={20}
                className="cursor-pointer text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                onClick={onClose}
              />
            )}
          </>
        )}
      </div>

      {/* BODY */}
      {isSettingsOpen && targetUser ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#333333] flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-neutral-700 flex items-center gap-2 bg-white dark:bg-[#262626] shrink-0">
            <button
              onClick={() => {
                if (settingsView === "menu") setIsSettingsOpen(false);
                else setSettingsView("menu");
              }}
              className="p-1 hover:bg-secondary rounded-full transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-[15px]">
              {settingsView === "menu" && "Cài đặt chung"}
              {settingsView === "search" && "Tìm kiếm tin nhắn"}
              {settingsView === "members" && "Thành viên nhóm"}
              {settingsView === "edit_name" && "Chỉnh sửa nhóm"}
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {settingsView === "menu" && (
              <>
                <div className="flex flex-col items-center justify-center py-6">
                  <img
                    src={targetUser?.avatar_url}
                    className="w-20 h-20 rounded-full mb-3 shadow-md border-2 border-white dark:border-[#262626]"
                  />
                  <span className="font-bold text-xl">{targetUser?.name}</span>
                  {targetUser?.is_group && (
                    <span className="text-xs text-muted-foreground mt-1 bg-secondary px-2 py-1 rounded-full">
                      Nhóm chat
                    </span>
                  )}
                </div>

                <div className="bg-white dark:bg-[#262626] rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm">
                  <button
                    onClick={() => setSettingsView("search")}
                    className="w-full flex items-center gap-3 p-3.5 hover:bg-secondary transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
                  >
                    <div className="bg-gray-100 dark:bg-[#333333] p-2 rounded-full">
                      <Search size={18} />
                    </div>{" "}
                    Tìm kiếm trong trò chuyện
                  </button>
                  {targetUser?.is_group && (
                    <>
                      <button
                        onClick={handleLoadMembers}
                        className="w-full flex items-center gap-3 p-3.5 hover:bg-secondary transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
                      >
                        <div className="bg-gray-100 dark:bg-[#333333] p-2 rounded-full">
                          <Users size={18} />
                        </div>{" "}
                        Xem thành viên nhóm
                      </button>
                      <button
                        onClick={() => {
                          setNewGroupName(targetUser.name);
                          setNewGroupAvatar(null);
                          setSettingsView("edit_name");
                        }}
                        className="w-full flex items-center gap-3 p-3.5 hover:bg-secondary transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
                      >
                        <div className="bg-gray-100 dark:bg-[#333333] p-2 rounded-full">
                          <Edit3 size={18} />
                        </div>{" "}
                        Chỉnh sửa nhóm
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleDeleteChat}
                    className="w-full flex items-center gap-3 p-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors text-[15px] font-semibold"
                  >
                    <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                      <Trash2 size={18} />
                    </div>{" "}
                    {targetUser?.is_group
                      ? "Rời / Xóa nhóm"
                      : "Xóa cuộc trò chuyện"}
                  </button>
                </div>
              </>
            )}

            {settingsView === "search" && (
              <>
                <div className="flex items-center gap-2 border border-gray-200 dark:border-neutral-700 shadow-inner bg-white dark:bg-[#262626] p-3 rounded-xl mb-4">
                  <Search size={18} className="text-muted-foreground" />
                  <input
                    autoFocus
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Nhập từ khóa tìm kiếm..."
                    className="flex-1 outline-none text-[15px] bg-transparent"
                  />
                </div>
                <div className="space-y-2">
                  {messages
                    .filter(
                      (m) =>
                        chatSearchQuery.trim() &&
                        m.content
                          .toLowerCase()
                          .includes(chatSearchQuery.toLowerCase()),
                    )
                    .map((m) => {
                      const senderName =
                        m.users?.name ||
                        (m.sender_id === userId ? "Bạn" : "Người dùng");
                      return (
                        <div
                          key={m.id}
                          className="p-3 bg-white dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col gap-1 cursor-pointer hover:border-blue-400 transition-colors"
                        >
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span className="font-bold text-gray-900 dark:text-gray-100">
                              {senderName}
                            </span>
                            <span>
                              {new Date(m.created_at).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-[15px] font-medium">{m.content}</p>
                        </div>
                      );
                    })}
                  {chatSearchQuery.trim() &&
                    messages.filter((m) =>
                      m.content
                        .toLowerCase()
                        .includes(chatSearchQuery.toLowerCase()),
                    ).length === 0 && (
                      <div className="text-center text-muted-foreground mt-10 flex flex-col items-center gap-2">
                        <Search size={32} className="opacity-20" />
                        <p>Không tìm thấy tin nhắn phù hợp.</p>
                      </div>
                    )}
                </div>
              </>
            )}

            {settingsView === "members" && (
              <div className="bg-white dark:bg-[#262626] rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm">
                {groupMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-neutral-800 last:border-0 hover:bg-secondary transition-colors"
                  >
                    <img
                      src={
                        member.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${member.id}`
                      }
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-neutral-700 shadow-sm"
                    />
                    <span className="font-semibold text-[15px]">
                      {member.name} {member.id === userId && "(Bạn)"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {settingsView === "edit_name" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={
                      newGroupAvatar
                        ? URL.createObjectURL(newGroupAvatar)
                        : targetUser?.avatar_url
                    }
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-neutral-700 shadow-sm"
                    alt="Group Avatar"
                  />
                  <label className="text-blue-500 font-semibold text-sm cursor-pointer hover:text-blue-600 transition-colors">
                    Đổi ảnh đại diện nhóm
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) =>
                        setNewGroupAvatar(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                </div>

                <div className="bg-white dark:bg-[#262626] rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm p-1">
                  <input
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nhập tên nhóm mới..."
                    className="w-full px-3 py-2 outline-none text-[15px] bg-transparent font-semibold"
                  />
                </div>
                <button
                  onClick={handleUpdateGroupName}
                  disabled={
                    !newGroupName.trim() ||
                    (newGroupName.trim() === targetUser.name && !newGroupAvatar)
                  }
                  className="w-full bg-blue-500 text-white font-bold rounded-xl p-3 text-[15px] hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  Lưu thay đổi
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {!targetUser ? (
            isCreatingGroup ? (
              <div className="space-y-4">
                <div>
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Nhập tên nhóm..."
                    className="w-full border-b border-gray-200 dark:border-neutral-700 bg-transparent py-2 outline-none text-sm font-semibold"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 border border-gray-200 dark:border-neutral-700 shadow-inner bg-gray-50 dark:bg-[#333333] focus-within:bg-white dark:focus-within:bg-[#262626] transition-all p-2 rounded-xl">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="flex-1 outline-none text-sm bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400"
                      placeholder="Tìm để thêm thành viên..."
                    />
                  </div>
                </div>

                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((m) => (
                      <div
                        key={m.id}
                        className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs px-3 py-1 rounded-full flex items-center gap-1.5 font-medium"
                      >
                        {m.name}
                        <X
                          size={14}
                          className="cursor-pointer hover:text-red-500"
                          onClick={() =>
                            setSelectedMembers((prev) =>
                              prev.filter((u) => u.id !== m.id),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  {results.map((u) => {
                    const isSelected = !!selectedMembers.find(
                      (m) => m.id === u.id,
                    );
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMembers((prev) =>
                              prev.filter((m) => m.id !== u.id),
                            );
                          } else {
                            setSelectedMembers((prev) => [...prev, u]);
                          }
                          setSearch("");
                        }}
                        className="flex items-center justify-between p-2 hover:bg-secondary rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar_url}
                            className="w-10 h-10 rounded-full"
                          />
                          <span className="text-sm font-semibold">
                            {u.name}
                          </span>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {isSelected && <X size={12} className="text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center px-1 mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Gần đây
                  </span>
                  <button
                    onClick={() => setIsCreatingGroup(true)}
                    className="text-xs text-blue-500 font-bold hover:underline flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Users size={14} /> Tạo nhóm mới
                  </button>
                </div>

                <div className="flex items-center gap-2 border border-gray-200 dark:border-neutral-700 shadow-inner bg-gray-50 dark:bg-[#333333] focus-within:bg-white dark:focus-within:bg-[#262626] focus-within:ring-1 focus-within:ring-blue-500 transition-all p-2 rounded-xl mb-3">
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
                      <img
                        src={u.avatar_url}
                        className="w-8 h-8 rounded-full"
                      />
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
                      {!c.is_group && onlineUsers.has(c.otherUser?.id) && (
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
            )
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
      )}

      {/* INPUT */}
      {targetUser &&
        !isSettingsOpen &&
        (targetUser.is_group || followedIds.has(targetUser.id) ? (
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
        ) : (
          <div className="p-4 border-t border-gray-200 dark:border-neutral-800 text-center bg-gray-50 dark:bg-[#333333]">
            <p className="text-sm text-muted-foreground font-medium">
              Bạn cần theo dõi người dùng này để tiếp tục trò chuyện.
            </p>
          </div>
        ))}

      {loading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Loader2 className="animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
