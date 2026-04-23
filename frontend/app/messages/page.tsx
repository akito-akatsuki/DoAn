"use client";

import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import {
  Search,
  Send,
  ChevronLeft,
  Loader2,
  MoreHorizontal,
  Ban,
  Image as ImageIcon,
  X,
  Paperclip,
  FileText,
  Download,
  Clock,
  Check,
  CheckCheck,
  Reply,
  Settings,
  Edit3,
  Trash2,
  Users,
  Phone,
  Video,
} from "lucide-react";
import toast from "react-hot-toast";
import { showConfirm } from "@/components/GlobalConfirm";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
  deleteMessage,
  getBlockedUsers,
  unblockUser,
  getConversationMembers,
  updateGroupName,
  deleteConversation,
  setNickname,
  blockUser,
  createCallRecord,
  updateCallRecord,
} from "@/lib/chatApi";

const VideoCall = dynamic(() => import("@/components/VideoCall"), {
  ssr: false,
});

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileAttachment, setFileAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  const [isTyping, setIsTyping] = useState(false);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef(0);
  const receiveTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(
    null,
  );

  // ================= SETTINGS STATES =================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<
    "menu" | "search" | "members" | "edit_name" | "edit_nickname"
  >("menu");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupAvatar, setNewGroupAvatar] = useState<File | null>(null);
  const [newNickname, setNewNickname] = useState("");

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // ================= BLOCKED USERS STATES =================
  const [isBlockedListOpen, setIsBlockedListOpen] = useState(false);
  const [blockedUsersList, setBlockedUsersList] = useState<any[]>([]);

  // ================= VIDEO CALL STATES =================
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing">(
    "idle",
  );
  const [callType, setCallType] = useState<"video" | "voice">("video");
  const [callRoomId, setCallRoomId] = useState("");
  const [callUserInfo, setCallUserInfo] = useState<any>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);

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
          setUser({ ...data.user, ...(dbUser || {}) });
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin user ở Messages:", err);
      }
    };
    loadUser();
  }, []);

  // ================= ONLINE STATUS (PRESENCE) =================
  useEffect(() => {
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

  // ================= SMOOTH SCROLL =================
  useEffect(() => {
    if (!scrollRef.current) return;
    requestAnimationFrame(() => {
      scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
    });
  }, [messages.length, isTyping]);

  // ================= LOAD CONVERSATIONS =================
  const loadConversations = useCallback(async () => {
    try {
      if (!user?.id) return;

      // Lọc danh sách bị chặn
      const { data: blockedData } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      const { data: blockerData } = await supabase
        .from("blocked_users")
        .select("blocker_id")
        .eq("blocked_id", user.id);
      const excludedIds = new Set([
        ...(blockedData || []).map((b) => b.blocked_id),
        ...(blockerData || []).map((b) => b.blocker_id),
      ]);

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

          if (excludedIds.has(otherId)) return null; // Ẩn người bị chặn

          const { data: u } = await supabase
            .from("users")
            .select("id, name, avatar_url")
            .eq("id", otherId)
            .maybeSingle();

          // Ưu tiên hiển thị tên gợi nhớ nếu có
          const { data: nick } = await supabase
            .from("nicknames")
            .select("nickname")
            .eq("conversation_id", c.id)
            .eq("user_id", user.id)
            .eq("target_id", otherId)
            .maybeSingle();

          if (u && nick?.nickname) u.name = nick.nickname;

          // Lấy trực tiếp tin nhắn mới nhất từ bảng messages
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content, sender_id, is_read, image_url, file_url")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          let displayTxt = c.last_message;
          let hasUnread = false;
          if (lastMsg) {
            displayTxt =
              lastMsg.sender_id === user.id
                ? `Bạn: ${lastMsg.content || (lastMsg.image_url ? "Đã gửi một ảnh" : lastMsg.file_url ? "Đã gửi một tệp" : "")}`
                : lastMsg.content ||
                  (lastMsg.image_url
                    ? "Đã gửi một ảnh"
                    : lastMsg.file_url
                      ? "Đã gửi một tệp"
                      : "");
            hasUnread = lastMsg.sender_id !== user.id && !lastMsg.is_read;
          }

          return {
            ...c,
            otherUser: u,
            display_last_message: displayTxt,
            has_unread: hasUnread,
          };
        }),
      );

      setConversations(enriched.filter(Boolean));
    } catch (err) {
      console.error("Lỗi tải danh sách trò chuyện:", err);
    }
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
      supabase
        .from("messages")
        .update({ is_read: true })
        .in("id", ids)
        .then(({ error }) => {
          if (error) console.error("Lỗi cập nhật is_read:", error);
        });
      setMessages((prev) =>
        prev.map((m) => (ids.includes(m.id) ? { ...m, is_read: true } : m)),
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, has_unread: false } : c,
        ),
      );
    }
  }, [messages, conversationId, user?.id]);

  // ================= VIDEO CALL REALTIME (SIGNALING) =================
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user_call_${user.id}`)
      .on("broadcast", { event: "call_signal" }, (payload) => {
        const {
          type,
          roomId,
          caller,
          callType: incomingCallType,
          callId,
        } = payload.payload;
        if (type === "OFFER") {
          setCallRoomId(roomId);
          setCallUserInfo(caller);
          setCallType(incomingCallType || "video");
          setCurrentCallId(callId);
          setCallState("ringing");
        } else if (type === "ACCEPT") {
          setIsInCall(true);
          setCallState("idle");
          setCallStartTime(Date.now());
        } else if (type === "REJECT") {
          setCallState("idle");
          toast.error(`${caller?.name || "Người dùng"} đã từ chối cuộc gọi.`);
          setCallUserInfo(null);
          setCurrentCallId(null);
        } else if (type === "END") {
          setIsInCall(false);
          setCallState("idle");
          setCallUserInfo(null);
          setCurrentCallId(null);
          setCallStartTime(null);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const sendCallSignalToUser = (targetId: string, payload: any) => {
    if (!targetId) return;
    const channel = supabase.channel(`user_call_${targetId}`);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "call_signal",
          payload,
        });
        setTimeout(() => supabase.removeChannel(channel), 1000);
      }
    });
  };

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

      // Bỏ qua bản thân và những người đã bị chặn khỏi tìm kiếm
      const { data: blockedData } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      const { data: blockerData } = await supabase
        .from("blocked_users")
        .select("blocker_id")
        .eq("blocked_id", user.id);
      const excludedIds = [
        ...(blockedData || []).map((b) => b.blocked_id),
        ...(blockerData || []).map((b) => b.blocker_id),
        user.id,
      ];

      let dbQuery = supabase
        .from("users")
        .select("id, name, avatar_url")
        .not("id", "in", `(${excludedIds.join(",")})`);

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

      // Kiểm tra tên gợi nhớ
      const { data: nick } = await supabase
        .from("nicknames")
        .select("nickname")
        .eq("conversation_id", id)
        .eq("user_id", user.id)
        .eq("target_id", target.id)
        .maybeSingle();

      const displayTarget = { ...target, name: nick?.nickname || target.name };
      setConversationId(id);
      setTargetUser(displayTarget);
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
    showConfirm(
      "Bạn có chắc chắn muốn xóa/rời khỏi cuộc trò chuyện này? Hành động này không thể hoàn tác.",
      async () => {
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
      },
    );
  };

  // ================= CALL CONTROL HANDLERS =================
  const startCall = (type: "video" | "voice") => {
    if (!targetUser || targetUser.is_group) return;
    const roomId = `room_${Date.now()}_${user?.id}`;
    setCallRoomId(roomId);
    setCallUserInfo(targetUser);
    setCallType(type);
    setCallState("calling");

    sendCallSignalToUser(targetUser.id, {
      type: "OFFER",
      callType: type,
      roomId,
      caller: user,
    });
  };

  const acceptCall = () => {
    setIsInCall(true);
    setCallState("idle");
    sendCallSignalToUser(callUserInfo?.id, {
      type: "ACCEPT",
      caller: user,
    });
  };

  const rejectCall = () => {
    setCallState("idle");
    sendCallSignalToUser(callUserInfo?.id, {
      type: "REJECT",
      caller: user,
    });
    setCallUserInfo(null);
  };

  const handleLeaveCall = () => {
    setIsInCall(false);
    setCallState("idle");
    sendCallSignalToUser(callUserInfo?.id, { type: "END" });
    setCallUserInfo(null);
  };

  // ================= GỬI TIN NHẮN =================
  const handleSend = async () => {
    if (
      (!text.trim() && !imageFile && !fileAttachment) ||
      !conversationId ||
      !user?.id
    )
      return;

    const msgText = text.trim();
    setText(""); // Xóa input ngay lập tức
    const currentImage = imageFile;
    setImageFile(null);
    const currentFile = fileAttachment;
    setFileAttachment(null);
    const currentReply = replyingTo;
    setReplyingTo(null);

    const tempMsg = {
      id: crypto.randomUUID(),
      sender_id: user.id,
      content: msgText,
      image_url: currentImage ? URL.createObjectURL(currentImage) : null,
      file_url: currentFile ? "#" : null,
      file_name: currentFile ? currentFile.name : null,
      file_type: currentFile ? currentFile.type : null,
      file_size: currentFile ? currentFile.size : null,
      reply_to_id: currentReply ? currentReply.id : null,
      status: "sending", // Trạng thái đang gửi
      created_at: new Date().toISOString(),
    };

    // Cập nhật UI tạm thời cho mượt
    setMessages((prev) => [...prev, tempMsg]);

    try {
      let uploadedImageUrl = null;
      if (currentImage) {
        const cleanName = currentImage.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `chat_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("chat_images")
          .upload(fileName, currentImage);

        if (uploadError) {
          throw new Error(
            "Không thể tải ảnh lên. Hãy kiểm tra Storage Bucket 'chat_images'.",
          );
        }

        const { data } = supabase.storage
          .from("chat_images")
          .getPublicUrl(fileName);
        uploadedImageUrl = data.publicUrl;
      }

      let uploadedFileUrl = null;
      let uploadedFileName = null;
      let uploadedFileType = null;
      let uploadedFileSize = null;

      if (currentFile) {
        const cleanName = currentFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `file_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("chat_files")
          .upload(fileName, currentFile);

        if (uploadError)
          throw new Error(
            "Lỗi tải file đính kèm lên. Hãy kiểm tra Storage Bucket 'chat_files'.",
          );

        const { data } = supabase.storage
          .from("chat_files")
          .getPublicUrl(fileName);
        uploadedFileUrl = data.publicUrl;
        uploadedFileName = currentFile.name;
        uploadedFileType = currentFile.type;
        uploadedFileSize = currentFile.size;
      }

      const msg = await sendMessage(
        conversationId,
        user.id,
        msgText,
        uploadedImageUrl,
        uploadedFileUrl,
        uploadedFileName,
        uploadedFileType,
        uploadedFileSize,
        currentReply ? currentReply.id : null,
      );
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? msg : m)));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gửi tin nhắn thất bại");
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
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

  // ================= THU HỒI TIN NHẮN =================
  const handleDeleteMessage = async (msgId: string) => {
    showConfirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?", async () => {
      try {
        await deleteMessage(msgId);
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setOpenMessageMenuId(null);
        toast.success("Đã thu hồi tin nhắn");
      } catch (err) {
        toast.error("Lỗi thu hồi tin nhắn");
      }
    });
  };

  // ================= BLOCKED CONTROL HANDLERS =================
  const handleLoadBlockedUsers = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const users = await getBlockedUsers(user.id);
      setBlockedUsersList(users);
    } catch (error) {
      toast.error("Lỗi tải danh sách chặn");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    try {
      await unblockUser(user?.id, blockedId);
      setBlockedUsersList((prev) => prev.filter((u) => u.id !== blockedId));
      toast.success("Đã bỏ chặn người dùng");
      loadConversations();
    } catch (error) {
      toast.error("Lỗi khi bỏ chặn");
    }
  };

  // ================= ĐỊNH DẠNG NGÀY THÁNG =================
  const formatMessageDate = (currentDateStr: string, prevDateStr?: string) => {
    const current = new Date(currentDateStr);
    const prev = prevDateStr ? new Date(prevDateStr) : null;

    const isSameDay =
      prev &&
      current.getDate() === prev.getDate() &&
      current.getMonth() === prev.getMonth() &&
      current.getFullYear() === prev.getFullYear();

    // Nhóm ngày mới HOẶC cách nhau quá 1 tiếng (60 * 60 * 1000 ms)
    const isBigGap =
      prev && current.getTime() - prev.getTime() > 60 * 60 * 1000;

    if (isSameDay && !isBigGap) return null;

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let dateLabel = "";
    if (current.toDateString() === today.toDateString()) {
      dateLabel = "Hôm nay";
    } else if (current.toDateString() === yesterday.toDateString()) {
      dateLabel = "Hôm qua";
    } else {
      dateLabel = current.toLocaleDateString("vi-VN", {
        day: "numeric",
        month: "short",
        year:
          current.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }

    const timeLabel = current.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateLabel} ${timeLabel}`;
  };

  return (
    <div className="h-screen flex flex-col text-gray-900 dark:text-gray-100 transition-colors duration-500 overflow-hidden bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[935px] w-full mx-auto flex-1 pt-[76px] px-4 pb-24 md:pb-6 flex flex-col overflow-hidden">
        <div className="flex-1 w-full h-full relative flex md:gap-4 bg-white dark:bg-[#262626] md:bg-transparent md:dark:bg-transparent rounded-xl md:rounded-none border border-gray-200 dark:border-neutral-800 md:border-0 shadow-sm md:shadow-none overflow-hidden md:overflow-visible">
          {/* CỘT TRÁI: DANH SÁCH CHAT */}
          <div
            className={`absolute md:relative inset-0 md:inset-auto w-full md:w-[350px] border-0 md:border border-gray-200 dark:border-neutral-800 shadow-none md:shadow-sm dark:shadow-black/30 rounded-none md:rounded-xl flex flex-col h-full transition-all duration-300 bg-white dark:bg-[#262626] z-10 ${
              targetUser
                ? "-translate-x-full opacity-0 invisible pointer-events-none md:translate-x-0 md:opacity-100 md:visible md:pointer-events-auto"
                : "translate-x-0 opacity-100 visible pointer-events-auto"
            }`}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 font-bold text-lg flex items-center justify-between">
              <span>
                {user?.name || user?.user_metadata?.name || "Tin nhắn"}
              </span>
              <button
                onClick={() => {
                  if (isBlockedListOpen) {
                    setIsBlockedListOpen(false);
                  } else {
                    setIsBlockedListOpen(true);
                    handleLoadBlockedUsers();
                  }
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-[#333333] rounded-full transition-colors"
                title="Quản lý chặn"
              >
                <Ban
                  size={20}
                  className={
                    isBlockedListOpen ? "text-red-500" : "text-muted-foreground"
                  }
                />
              </button>
            </div>

            {!isBlockedListOpen && (
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
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isBlockedListOpen ? (
                <div className="space-y-2 px-1 mt-2">
                  <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                    Danh sách chặn
                  </h3>
                  {blockedUsersList.length === 0 ? (
                    <div className="text-center text-muted-foreground p-4 text-[15px]">
                      Không có người bị chặn.
                    </div>
                  ) : (
                    blockedUsersList.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-neutral-800 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              u.avatar_url ||
                              `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                            }
                            className="w-10 h-10 rounded-full border border-gray-200 dark:border-neutral-700 shadow-sm object-cover"
                          />
                          <span className="font-medium text-[15px]">
                            {u.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleUnblock(u.id)}
                          className="bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        >
                          Bỏ chặn
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  {/* Hiển thị kết quả tìm kiếm nếu có */}
                  {results.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleOpenChat(u)}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-[#333333]"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={
                            u.avatar_url ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                          }
                          className="w-12 h-12 rounded-full border border-gray-200 dark:border-neutral-700 shadow-sm object-cover"
                        />
                        {onlineUsers.has(u.id) && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></span>
                        )}
                      </div>
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
                        <div className="relative flex-shrink-0">
                          <img
                            src={
                              c.otherUser?.avatar_url ||
                              `https://api.dicebear.com/7.x/identicon/svg?seed=${c.otherUser?.id}`
                            }
                            className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-neutral-700 shadow-sm flex-shrink-0"
                          />
                          {!c.is_group && onlineUsers.has(c.otherUser?.id) && (
                            <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[15px] truncate ${c.has_unread ? "font-bold text-gray-900 dark:text-gray-100" : "font-semibold"}`}
                          >
                            {c.otherUser?.name}
                          </p>
                          {/* Hiển thị tin nhắn mới nhất */}
                          <p
                            className={`text-[14px] truncate mt-0.5 ${c.display_last_message ? (c.has_unread ? "font-bold text-gray-900 dark:text-gray-100" : "text-muted-foreground") : "text-gray-400 italic"}`}
                          >
                            {c.display_last_message ||
                              "Hãy là người bắt đầu cuộc trò chuyện"}
                          </p>
                        </div>
                        {c.has_unread && (
                          <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                        )}
                      </div>
                    ))}
                </>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: KHUNG CHAT CHI TIẾT */}
          <div
            className={`absolute md:relative inset-0 md:inset-auto w-full md:w-auto md:flex-1 border-0 md:border border-gray-200 dark:border-neutral-800 shadow-none md:shadow-sm dark:shadow-black/30 rounded-none md:rounded-xl flex flex-col h-full transition-all duration-300 bg-white dark:bg-[#262626] z-20 ${
              !targetUser
                ? "translate-x-full opacity-0 invisible pointer-events-none md:translate-x-0 md:opacity-100 md:visible md:pointer-events-auto"
                : "translate-x-0 opacity-100 visible pointer-events-auto"
            }`}
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
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      className="md:hidden p-1 -ml-2"
                      onClick={() => {
                        setTargetUser(null);
                        setConversationId(null);
                        setMessages([]);
                        setIsSettingsOpen(false);
                      }}
                    >
                      <ChevronLeft size={28} />
                    </button>
                    <div className="relative flex-shrink-0">
                      <img
                        src={
                          targetUser?.avatar_url ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${targetUser.id}`
                        }
                        className="w-11 h-11 rounded-full border border-gray-200 dark:border-neutral-700 shadow-sm object-cover flex-shrink-0"
                      />
                      {!targetUser?.is_group &&
                        targetUser &&
                        onlineUsers.has(targetUser.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></span>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[16px] truncate">
                        {targetUser?.name}
                      </span>
                      {targetUser?.is_group ? (
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          Nhóm chat
                        </span>
                      ) : targetUser && onlineUsers.has(targetUser.id) ? (
                        <span className="text-[11px] text-green-500 font-medium mt-0.5">
                          Đang hoạt động
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          Ngoại tuyến
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!targetUser?.is_group && (
                      <>
                        <button
                          onClick={() => startCall("voice")}
                          className="p-2 hover:bg-secondary rounded-full transition-colors text-blue-500"
                        >
                          <Phone size={20} />
                        </button>
                        <button
                          onClick={() => startCall("video")}
                          className="p-2 hover:bg-secondary rounded-full transition-colors text-blue-500"
                        >
                          <Video size={20} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        if (isSettingsOpen && settingsView === "menu") {
                          setIsSettingsOpen(false);
                        } else {
                          setIsSettingsOpen(true);
                          setSettingsView("menu");
                          setChatSearchQuery("");
                        }
                      }}
                      className={`p-2 hover:bg-secondary rounded-full transition-colors ${isSettingsOpen ? "bg-secondary text-blue-600" : "text-blue-500"}`}
                    >
                      <Settings size={20} />
                    </button>
                  </div>
                </div>

                {isSettingsOpen ? (
                  <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#333333] flex flex-col relative z-20">
                    <div className="p-4 flex items-center gap-2 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#262626] sticky top-0 z-10">
                      <button
                        onClick={() =>
                          settingsView === "menu"
                            ? setIsSettingsOpen(false)
                            : setSettingsView("menu")
                        }
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <span className="font-bold text-lg">
                        {settingsView === "menu" && "Cài đặt chung"}
                        {settingsView === "search" && "Tìm kiếm tin nhắn"}
                        {settingsView === "members" && "Thành viên nhóm"}
                        {settingsView === "edit_name" && "Chỉnh sửa nhóm"}
                        {settingsView === "edit_nickname" && "Đổi tên gợi nhớ"}
                      </span>
                    </div>
                    <div className="p-4 space-y-4">
                      {settingsView === "menu" && (
                        <>
                          <div className="flex flex-col items-center justify-center py-6">
                            <img
                              src={
                                targetUser?.avatar_url ||
                                `https://api.dicebear.com/7.x/identicon/svg?seed=${targetUser?.id}`
                              }
                              className="w-24 h-24 rounded-full mb-3 shadow-md object-cover"
                            />
                            <span className="font-bold text-2xl text-center">
                              {targetUser?.name}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-[#262626] rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm">
                            <button
                              onClick={() => setSettingsView("search")}
                              className="w-full flex items-center gap-3 p-4 hover:bg-secondary transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
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
                                  className="w-full flex items-center gap-3 p-4 hover:bg-secondary transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
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
                                  className="w-full flex items-center gap-3 p-4 hover:bg-secondary transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
                                >
                                  <div className="bg-gray-100 dark:bg-[#333333] p-2 rounded-full">
                                    <Edit3 size={18} />
                                  </div>{" "}
                                  Chỉnh sửa nhóm
                                </button>
                              </>
                            )}
                            {!targetUser?.is_group && (
                              <>
                                <button
                                  onClick={() => {
                                    setNewNickname(targetUser.name);
                                    setSettingsView("edit_nickname");
                                  }}
                                  className="w-full flex items-center gap-3 p-4 hover:bg-secondary transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
                                >
                                  <div className="bg-gray-100 dark:bg-[#333333] p-2 rounded-full">
                                    <Edit3 size={18} />
                                  </div>{" "}
                                  Đổi tên gợi nhớ
                                </button>
                                <button
                                  onClick={() => {
                                    showConfirm(
                                      "Bạn có chắc chắn muốn chặn người dùng này?",
                                      async () => {
                                        try {
                                          await blockUser(
                                            user?.id,
                                            targetUser!.id,
                                          );
                                          toast.success("Đã chặn người dùng");
                                          setTargetUser(null);
                                          setConversationId(null);
                                          setIsSettingsOpen(false);
                                          loadConversations();
                                        } catch (e) {
                                          toast.error(
                                            "Lỗi khi chặn người dùng",
                                          );
                                        }
                                      },
                                    );
                                  }}
                                  className="w-full flex items-center gap-3 p-4 hover:bg-red-50 text-red-500 transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
                                >
                                  <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                                    <Ban size={18} />
                                  </div>{" "}
                                  Chặn người dùng
                                </button>
                              </>
                            )}
                            <button
                              onClick={handleDeleteChat}
                              className="w-full flex items-center gap-3 p-4 hover:bg-red-50 text-red-500 transition-colors text-[15px] font-semibold"
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
                            <Search
                              size={18}
                              className="text-muted-foreground"
                            />
                            <input
                              autoFocus
                              value={chatSearchQuery}
                              onChange={(e) =>
                                setChatSearchQuery(e.target.value)
                              }
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
                              .map((m) => (
                                <div
                                  key={m.id}
                                  className="p-3 bg-white dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col gap-1 cursor-pointer hover:border-blue-400 transition-colors"
                                >
                                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span className="font-bold text-gray-900 dark:text-gray-100">
                                      {m.users?.name ||
                                        (m.sender_id === user?.id
                                          ? "Bạn"
                                          : "Người dùng")}
                                    </span>
                                    <span>
                                      {new Date(m.created_at).toLocaleString(
                                        "vi-VN",
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          day: "2-digit",
                                          month: "2-digit",
                                        },
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-[15px] font-medium">
                                    {m.content}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </>
                      )}
                      {settingsView === "members" && (
                        <div className="bg-white dark:bg-[#262626] rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm">
                          {groupMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-neutral-800 last:border-0 hover:bg-secondary"
                            >
                              <img
                                src={
                                  member.avatar_url ||
                                  `https://api.dicebear.com/7.x/identicon/svg?seed=${member.id}`
                                }
                                className="w-10 h-10 rounded-full object-cover"
                              />
                              <span className="font-semibold text-[15px]">
                                {member.name}{" "}
                                {member.id === user?.id && "(Bạn)"}
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
                                  : targetUser?.avatar_url ||
                                    `https://api.dicebear.com/7.x/identicon/svg?seed=${targetUser?.id}`
                              }
                              className="w-24 h-24 rounded-full object-cover shadow-sm"
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
                            disabled={!newGroupName.trim()}
                            className="w-full bg-blue-500 text-white font-bold rounded-xl p-3 text-[15px] hover:bg-blue-600 transition-colors disabled:opacity-50"
                          >
                            Lưu thay đổi
                          </button>
                        </div>
                      )}
                      {settingsView === "edit_nickname" && (
                        <div className="space-y-4">
                          <div className="flex flex-col items-center gap-3">
                            <img
                              src={
                                targetUser?.avatar_url ||
                                `https://api.dicebear.com/7.x/identicon/svg?seed=${targetUser?.id}`
                              }
                              className="w-24 h-24 rounded-full object-cover shadow-sm"
                            />
                          </div>
                          <div className="bg-white dark:bg-[#262626] rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm p-1">
                            <input
                              autoFocus
                              value={newNickname}
                              onChange={(e) => setNewNickname(e.target.value)}
                              placeholder="Nhập tên gợi nhớ..."
                              className="w-full px-3 py-2 outline-none text-[15px] bg-transparent font-semibold"
                            />
                          </div>
                          <button
                            onClick={async () => {
                              if (!conversationId || !targetUser) return;
                              try {
                                await setNickname(
                                  conversationId,
                                  user?.id,
                                  targetUser.id,
                                  newNickname.trim(),
                                );
                                setTargetUser((prev: any) => ({
                                  ...prev,
                                  name: newNickname.trim() || prev?.name,
                                }));
                                setSettingsView("menu");
                                toast.success("Đã cập nhật tên gợi nhớ");
                                loadConversations();
                              } catch (e) {
                                toast.error("Lỗi khi cập nhật tên gợi nhớ");
                              }
                            }}
                            disabled={!newNickname.trim()}
                            className="w-full bg-blue-500 text-white font-bold rounded-xl p-3 text-[15px] hover:bg-blue-600 transition-colors disabled:opacity-50"
                          >
                            Lưu thay đổi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* NỘI DUNG CHAT */}
                    <div
                      ref={scrollRef}
                      className="flex-1 overflow-y-auto p-4 space-y-3"
                      onClick={() => setOpenMessageMenuId(null)}
                    >
                      {messages.map((m, index) => {
                        const isLastMessage = index === messages.length - 1;
                        const dateSeparator = formatMessageDate(
                          m.created_at,
                          index > 0
                            ? messages[index - 1].created_at
                            : undefined,
                        );

                        return (
                          <div
                            key={m.id}
                            id={`msg-${m.id}`}
                            className="flex flex-col"
                          >
                            {dateSeparator && (
                              <div className="text-center text-[12px] text-muted-foreground my-4 font-medium">
                                {dateSeparator}
                              </div>
                            )}
                            <div
                              className={`flex w-full gap-2 ${m.sender_id === user?.id ? "justify-end" : "justify-start"} group relative items-end mb-1`}
                            >
                              {m.sender_id === user?.id && (
                                <div className="flex flex-col items-end transition-opacity gap-1 pb-1 order-first px-1">
                                  <div className="flex items-center gap-2">
                                    <Reply
                                      size={16}
                                      className="cursor-pointer text-muted-foreground hover:text-blue-500"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReplyingTo(m);
                                      }}
                                    />
                                    <div className="relative">
                                      <MoreHorizontal
                                        size={16}
                                        className="cursor-pointer text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenMessageMenuId(
                                            m.id === openMessageMenuId
                                              ? null
                                              : m.id,
                                          );
                                        }}
                                      />
                                      {openMessageMenuId === m.id && (
                                        <div className="absolute right-0 bottom-full mb-2 w-28 bg-white dark:bg-[#333333] border border-gray-200 dark:border-neutral-700 rounded-lg shadow-xl z-[999] overflow-hidden">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteMessage(m.id);
                                            }}
                                            className="w-full text-left px-3 py-2 text-[14px] text-red-500 hover:bg-secondary font-medium transition-colors"
                                          >
                                            Thu hồi
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center whitespace-nowrap text-[10px] text-muted-foreground">
                                    <span className="mr-1">
                                      {m.status === "sending" ? (
                                        <Clock size={12} />
                                      ) : m.is_read ? (
                                        <CheckCheck
                                          size={14}
                                          className="text-blue-500"
                                        />
                                      ) : (
                                        <Check size={14} />
                                      )}
                                    </span>
                                    <span>
                                      {new Date(
                                        m.created_at,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                </div>
                              )}
                              <div
                                className={`px-4 py-2 text-[15px] max-w-[70%] break-words flex flex-col relative ${
                                  m.sender_id === user?.id
                                    ? "bg-[#0095F6] text-white rounded-2xl rounded-br-sm shadow-sm"
                                    : "rounded-2xl rounded-bl-sm border bg-gray-100 dark:bg-[#333333] text-gray-900 dark:text-gray-100 border-transparent dark:border-neutral-700 shadow-sm"
                                }`}
                              >
                                {m.reply_to_id && (
                                  <div
                                    className={`mb-2 border-l-4 border-current px-2 py-1.5 rounded-r text-xs cursor-pointer opacity-90 hover:opacity-100 transition-opacity ${m.sender_id === user?.id ? "bg-white/20" : "bg-black/5 dark:bg-white/10"}`}
                                    onClick={() => {
                                      const el = document.getElementById(
                                        `msg-${m.reply_to_id}`,
                                      );
                                      if (el)
                                        el.scrollIntoView({
                                          behavior: "smooth",
                                          block: "center",
                                        });
                                    }}
                                  >
                                    {(() => {
                                      const repliedMsg = messages.find(
                                        (msg) => msg.id === m.reply_to_id,
                                      );
                                      if (!repliedMsg)
                                        return (
                                          <span className="italic">
                                            Tin nhắn đã bị thu hồi
                                          </span>
                                        );
                                      return (
                                        <div className="flex flex-col min-w-0">
                                          <span className="font-bold text-[11px] mb-0.5">
                                            {repliedMsg.users?.name ||
                                              (repliedMsg.sender_id === user?.id
                                                ? "Bạn"
                                                : "Người dùng")}
                                          </span>
                                          <span className="truncate line-clamp-1">
                                            {repliedMsg.content ||
                                              (repliedMsg.image_url
                                                ? "Hình ảnh"
                                                : repliedMsg.file_url
                                                  ? "Tệp đính kèm"
                                                  : "")}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                {m.image_url && (
                                  <img
                                    src={m.image_url}
                                    alt="chat-img"
                                    className="max-w-full rounded-lg mb-1 object-cover"
                                  />
                                )}
                                {m.content}
                                {m.file_url && (
                                  <a
                                    href={m.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-3 p-2 rounded-lg mt-2 cursor-pointer transition-colors border ${m.sender_id === user?.id ? "bg-white/20 hover:bg-white/30 border-white/30 text-white" : "bg-white dark:bg-[#262626] hover:bg-gray-50 dark:hover:bg-[#333333] border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-gray-100"}`}
                                  >
                                    <div
                                      className={`p-2 rounded-lg ${m.sender_id === user?.id ? "bg-white/30" : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"}`}
                                    >
                                      <FileText size={20} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[13px] font-semibold truncate max-w-[150px]">
                                        {m.file_name || "Tệp đính kèm"}
                                      </span>
                                      <span className="text-[10px] opacity-80">
                                        {m.file_size
                                          ? (m.file_size / 1024 / 1024).toFixed(
                                              2,
                                            ) + " MB"
                                          : ""}
                                      </span>
                                    </div>
                                    <Download
                                      size={16}
                                      className="ml-2 opacity-80"
                                    />
                                  </a>
                                )}
                              </div>
                              {m.sender_id !== user?.id && (
                                <div className="flex flex-col items-start transition-opacity gap-1 pb-1 px-1">
                                  <div className="flex items-center gap-2">
                                    <Reply
                                      size={16}
                                      className="cursor-pointer text-muted-foreground hover:text-blue-500"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReplyingTo(m);
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center whitespace-nowrap text-[10px] text-muted-foreground">
                                    <span>
                                      {new Date(
                                        m.created_at,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                </div>
                              )}
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
                    <div className="flex flex-col border-t border-gray-200 dark:border-neutral-800 rounded-b-xl shrink-0 transition-colors duration-500 bg-white dark:bg-[#262626] shadow-[0_-2px_10px_rgba(0,0,0,0.02)] dark:shadow-black/20">
                      {replyingTo && (
                        <div className="p-3 pb-0">
                          <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 border-l-4 border-blue-500 p-2 rounded-r-lg">
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-blue-500">
                                Đang trả lời{" "}
                                {replyingTo.users?.name ||
                                  (replyingTo.sender_id === user?.id
                                    ? "chính mình"
                                    : targetUser?.name)}
                              </span>
                              <span className="text-xs text-muted-foreground truncate line-clamp-1">
                                {replyingTo.content ||
                                  (replyingTo.image_url
                                    ? "Hình ảnh"
                                    : replyingTo.file_name
                                      ? "Tệp đính kèm"
                                      : "")}
                              </span>
                            </div>
                            <button
                              onClick={() => setReplyingTo(null)}
                              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full shrink-0"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                      {imageFile && (
                        <div className="p-4 pb-0 relative inline-block">
                          <div className="relative inline-block">
                            <img
                              src={URL.createObjectURL(imageFile)}
                              alt="preview"
                              className="h-20 rounded-lg object-cover border border-gray-200 dark:border-neutral-700"
                            />
                            <button
                              onClick={() => setImageFile(null)}
                              className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 hover:bg-gray-700 shadow-sm"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                      {fileAttachment && (
                        <div className="p-4 pb-0 relative inline-block">
                          <div className="flex items-center gap-2 bg-secondary p-2 rounded-lg border border-gray-200 dark:border-neutral-700">
                            <FileText size={20} className="text-blue-500" />
                            <span className="text-sm truncate max-w-[100px]">
                              {fileAttachment.name}
                            </span>
                            <button
                              onClick={() => setFileAttachment(null)}
                              className="bg-gray-800 text-white rounded-full p-1 hover:bg-gray-700 shadow-sm ml-2"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="p-4 flex gap-3 items-center">
                        <label className="cursor-pointer text-gray-500 hover:text-blue-500 transition-colors flex items-center justify-center">
                          <Paperclip size={24} />
                          <input
                            type="file"
                            accept="*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 20 * 1024 * 1024) {
                                  toast.error("Dung lượng file tối đa là 20MB");
                                  return;
                                }
                                setFileAttachment(file);
                              }
                            }}
                          />
                        </label>
                        <label className="cursor-pointer text-gray-500 hover:text-blue-500 transition-colors flex items-center justify-center">
                          <ImageIcon size={26} />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              setImageFile(e.target.files?.[0] || null)
                            }
                          />
                        </label>
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
                                  payload: {
                                    isTyping: false,
                                    senderId: user?.id,
                                  },
                                });
                                lastTypingTimeRef.current = 0;
                              } else {
                                const now = Date.now();
                                if (now - lastTypingTimeRef.current > 1000) {
                                  typingChannelRef.current.send({
                                    type: "broadcast",
                                    event: "typing",
                                    payload: {
                                      isTyping: true,
                                      senderId: user?.id,
                                    },
                                  });
                                  lastTypingTimeRef.current = now;
                                }
                                if (typingTimeoutRef.current)
                                  clearTimeout(typingTimeoutRef.current);
                                typingTimeoutRef.current = setTimeout(() => {
                                  typingChannelRef.current?.send({
                                    type: "broadcast",
                                    event: "typing",
                                    payload: {
                                      isTyping: false,
                                      senderId: user?.id,
                                    },
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
                          disabled={
                            !text.trim() && !imageFile && !fileAttachment
                          }
                          className="bg-[#0095F6] hover:bg-blue-600 disabled:opacity-50 transition-colors text-white px-5 rounded-full flex items-center justify-center font-semibold text-[15px]"
                        >
                          Gửi
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* LOADING OVERLAY */}
                {loading && (
                  <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl bg-white/60 dark:bg-[#262626]/60">
                    <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      {/* ================= CALL OVERLAYS (RENDER FULL SCREEN BẰNG PORTAL) ================= */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {callState === "ringing" && (
              <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-[#262626] rounded-3xl p-8 flex flex-col items-center gap-6 text-center max-w-sm w-full shadow-2xl">
                  <img
                    src={
                      callUserInfo?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${callUserInfo?.id}`
                    }
                    className="w-28 h-28 rounded-full border-4 border-blue-500 animate-bounce object-cover shadow-lg"
                  />
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {callUserInfo?.name}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-lg">
                      Đang gọi {callType === "video" ? "video" : "thoại"} cho
                      bạn...
                    </p>
                  </div>
                  <div className="flex gap-4 w-full mt-4">
                    <button
                      onClick={rejectCall}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-xl font-bold transition-all active:scale-95"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={acceptCall}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3.5 rounded-xl font-bold transition-all active:scale-95 shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                    >
                      Nghe máy
                    </button>
                  </div>
                </div>
              </div>
            )}

            {callState === "calling" && (
              <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-[#262626] rounded-3xl p-8 flex flex-col items-center gap-6 text-center max-w-sm w-full shadow-2xl">
                  <img
                    src={
                      callUserInfo?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${callUserInfo?.id}`
                    }
                    className="w-28 h-28 rounded-full border-4 border-gray-200 dark:border-neutral-700 animate-pulse object-cover shadow-lg"
                  />
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {callUserInfo?.name}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-lg">
                      Đang đổ chuông...
                    </p>
                  </div>
                  <button
                    onClick={handleLeaveCall}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-xl font-bold mt-4 transition-all active:scale-95"
                  >
                    Hủy cuộc gọi
                  </button>
                </div>
              </div>
            )}

            {isInCall && (
              <VideoCall
                roomID={callRoomId}
                userID={user?.id}
                userName={user?.name || "Người dùng"}
                onLeave={handleLeaveCall}
                callType={callType}
              />
            )}
          </>,
          document.body,
        )}
    </div>
  );
}
