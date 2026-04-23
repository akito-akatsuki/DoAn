"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Video,
  Phone,
  MoreHorizontal,
  Ban,
  Image as ImageIcon,
  Paperclip,
  FileText,
  Download,
  Clock,
  Check,
  CheckCheck,
  Reply,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { showConfirm } from "@/components/GlobalConfirm";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
  createGroupChat,
  getConversationMembers,
  updateGroupName,
  deleteConversation,
  deleteMessage,
  setNickname,
  blockUser,
  getBlockedUsers,
  unblockUser,
  createCallRecord,
  updateCallRecord,
} from "@/lib/chatApi";
import dynamic from "next/dynamic";

const VideoCall = dynamic(() => import("./VideoCall"), { ssr: false });

interface ChatBoxProps {
  userId: string;
  onClose?: () => void;
}

export default function ChatBox({ userId, onClose }: ChatBoxProps) {
  const router = useRouter();
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

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);

  // ================= BLOCKED USERS STATES =================
  const [isBlockedListOpen, setIsBlockedListOpen] = useState(false);
  const [blockedUsersList, setBlockedUsersList] = useState<any[]>([]);

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
    "menu" | "search" | "members" | "edit_name" | "edit_nickname"
  >("menu");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupAvatar, setNewGroupAvatar] = useState<File | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [newNickname, setNewNickname] = useState("");
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(
    null,
  );

  // ================= VIDEO CALL STATES =================
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing">(
    "idle",
  );
  const [callType, setCallType] = useState<"video" | "voice">("video");
  const [callRoomId, setCallRoomId] = useState("");
  const [callUserInfo, setCallUserInfo] = useState<any>(null); // Lưu thông tin người gọi/người nhận
  const [isInCall, setIsInCall] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);

  // ================= LOAD CURRENT USER =================
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        setCurrentUser(data);
      });
  }, [userId]);

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

  // ================= VIDEO CALL REALTIME (SIGNALING) =================
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user_call_${userId}`)
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
  }, [userId]);

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

  // ================= READ RECEIPTS (ĐÃ XEM) =================
  useEffect(() => {
    if (!conversationId || !userId || messages.length === 0) return;

    const unreadMsgs = messages.filter(
      (m) => m.sender_id !== userId && !m.is_read,
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
  }, [messages, conversationId, userId]);

  // ================= LOAD CONVERSATIONS (OPTIMIZED) =================
  const loadConversations = useCallback(async () => {
    try {
      if (!userId) return;

      // 1. Lấy danh sách ID người dùng đã chặn hoặc bị chặn để ẩn họ đi
      const { data: blockedData } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", userId);
      const { data: blockerData } = await supabase
        .from("blocked_users")
        .select("blocker_id")
        .eq("blocked_id", userId);
      const excludedIds = new Set([
        ...(blockedData || []).map((b) => b.blocked_id),
        ...(blockerData || []).map((b) => b.blocker_id),
      ]);

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

            // Bỏ qua nếu người này nằm trong danh sách chặn
            if (excludedIds.has(otherId)) return null;

            const { data: user } = await supabase
              .from("users")
              .select("id, name, avatar_url")
              .eq("id", otherId)
              .maybeSingle();

            // Ưu tiên hiển thị tên gợi nhớ nếu có thiết lập
            const { data: nick } = await supabase
              .from("nicknames")
              .select("nickname")
              .eq("conversation_id", c.id)
              .eq("user_id", userId)
              .eq("target_id", otherId)
              .maybeSingle();

            if (user && nick?.nickname) user.name = nick.nickname;
            otherUser = user;
          }

          // Lấy trực tiếp tin nhắn mới nhất
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
              lastMsg.sender_id === userId
                ? `Bạn: ${lastMsg.content || (lastMsg.image_url ? "Đã gửi một ảnh" : lastMsg.file_url ? "Đã gửi một tệp" : "")}`
                : lastMsg.content ||
                  (lastMsg.image_url
                    ? "Đã gửi một ảnh"
                    : lastMsg.file_url
                      ? "Đã gửi một tệp"
                      : "");
            hasUnread = lastMsg.sender_id !== userId && !lastMsg.is_read;
          }

          return {
            ...c,
            otherUser: otherUser,
            display_last_message: displayTxt,
            has_unread: hasUnread,
          };
        }),
      );

      setConversations(enriched.filter(Boolean));
    } catch (err) {
      console.error("Lỗi tải danh sách trò chuyện:", err);
    }
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

      const { data: blockedData } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", userId);
      const { data: blockerData } = await supabase
        .from("blocked_users")
        .select("blocker_id")
        .eq("blocked_id", userId);
      const excludedIds = new Set([
        ...(blockedData || []).map((b) => b.blocked_id),
        ...(blockerData || []).map((b) => b.blocker_id),
      ]);

      const followingIds = (follows || [])
        .map((f) => f.following_id)
        .filter((id) => !excludedIds.has(id));

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

      let dbQuery = supabase
        .from("users")
        .select("id, name, avatar_url")
        .in("id", followingIds);

      const words = search.trim().split(/\s+/);
      words.forEach((word) => {
        dbQuery = dbQuery.ilike("name", `%${word}%`);
      });

      const { data } = await dbQuery.limit(15);

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

      // Kiểm tra tên gợi nhớ để hiển thị cho chuẩn xác
      const { data: nick } = await supabase
        .from("nicknames")
        .select("nickname")
        .eq("conversation_id", id)
        .eq("user_id", userId)
        .eq("target_id", user.id)
        .maybeSingle();

      const displayUser = { ...user, name: nick?.nickname || user.name };
      setConversationId(id);
      setTargetUser(displayUser);
      setIsSettingsOpen(false); // Đóng cài đặt nếu đang mở

      const msgs = await getMessages(id);
      setMessages(msgs || []);
    } catch (err) {
      console.error("Lỗi mở cuộc trò chuyện:", err);
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
    if (
      (!text.trim() && !imageFile && !fileAttachment) ||
      !conversationId ||
      !userId
    )
      return;

    const msgText = text.trim();
    setText("");
    const currentImage = imageFile;
    setImageFile(null);
    const currentFile = fileAttachment;
    setFileAttachment(null);
    const currentReply = replyingTo;
    setReplyingTo(null);

    // 🔥 OPTIMISTIC UPDATE (GIÚP MƯỢT)
    const tempMsg = {
      id: crypto.randomUUID(),
      sender_id: userId,
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

    setMessages((prev) => [...prev, tempMsg]);

    try {
      let uploadedImageUrl = null;
      if (currentImage) {
        const cleanName = currentImage.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `chat_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("chat_images") // Đảm bảo bạn đã tạo bucket này trên Supabase
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

      // Lưu ý: Nhớ update hàm sendMessage trong lib/chatApi để nó nhận thêm tham số uploadedImageUrl nhé!
      const msg = await sendMessage(
        conversationId,
        userId,
        msgText,
        uploadedImageUrl,
        uploadedFileUrl,
        uploadedFileName,
        uploadedFileType,
        uploadedFileSize,
        currentReply ? currentReply.id : null,
      );

      // replace temp
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
        payload: { isTyping: false, senderId: userId },
      });
    }
    lastTypingTimeRef.current = 0;
  };

  // ================= CALL CONTROL HANDLERS =================
  const startCall = (type: "video" | "voice") => {
    if (!targetUser || targetUser.is_group) return;
    const roomId = `room_${Date.now()}_${userId}`;
    setCallRoomId(roomId);
    setCallUserInfo(targetUser);
    setCallType(type);
    setCallState("calling");

    sendCallSignalToUser(targetUser.id, {
      type: "OFFER",
      callType: type,
      roomId,
      caller: currentUser,
    });
  };

  const acceptCall = () => {
    setIsInCall(true);
    setCallState("idle");
    sendCallSignalToUser(callUserInfo?.id, {
      type: "ACCEPT",
      caller: currentUser,
    });
  };

  const rejectCall = () => {
    setCallState("idle");
    sendCallSignalToUser(callUserInfo?.id, {
      type: "REJECT",
      caller: currentUser,
    });
    setCallUserInfo(null);
  };

  const handleLeaveCall = () => {
    setIsInCall(false);
    setCallState("idle");
    sendCallSignalToUser(callUserInfo?.id, { type: "END" });
    setCallUserInfo(null);
  };

  // ================= BLOCKED CONTROL HANDLERS =================
  const handleLoadBlockedUsers = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const users = await getBlockedUsers(userId);
      setBlockedUsersList(users);
    } catch (error) {
      toast.error("Lỗi tải danh sách chặn");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    try {
      await unblockUser(userId, blockedId);
      setBlockedUsersList((prev) => prev.filter((u) => u.id !== blockedId));
      toast.success("Đã bỏ chặn người dùng");
      loadConversations();
    } catch (error) {
      toast.error("Lỗi khi bỏ chặn");
    }
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
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100 overflow-hidden relative transition-colors duration-500">
      {/* HEADER */}
      <div className="relative min-h-[68px] shrink-0 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-black/20 overflow-hidden">
        {/* LIST HEADER */}
        <div
          className={`absolute inset-0 flex items-center justify-between p-4 transition-all duration-300 bg-white dark:bg-[#262626] z-10 ${targetUser ? "-translate-x-full opacity-0 invisible pointer-events-none" : "translate-x-0 opacity-100 visible pointer-events-auto"}`}
        >
          {isCreatingGroup ? (
            <>
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
            </>
          ) : isBlockedListOpen ? (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsBlockedListOpen(false)}>
                  <ChevronLeft size={20} />
                </button>
                <span className="font-bold">Danh sách chặn</span>
              </div>
            </>
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

        {/* NORMAL CHAT HEADER */}
        <div
          className={`absolute inset-0 flex items-center justify-between p-4 transition-all duration-300 bg-white dark:bg-[#262626] z-20 ${!targetUser ? "translate-x-full opacity-0 invisible pointer-events-none" : isSettingsOpen ? "-translate-x-full opacity-0 invisible pointer-events-none" : "translate-x-0 opacity-100 visible pointer-events-auto"}`}
        >
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
                onClick={() => {
                  if (!targetUser?.is_group) {
                    router.push(`/profile/${targetUser?.id}`);
                    if (onClose) onClose();
                  }
                }}
                className={`w-8 h-8 rounded-full ${!targetUser?.is_group ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
              />
              {!targetUser?.is_group &&
                targetUser &&
                onlineUsers.has(targetUser.id) && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></span>
                )}
            </div>
            <div className="flex flex-col">
              <span
                onClick={() => {
                  if (!targetUser?.is_group) {
                    router.push(`/profile/${targetUser?.id}`);
                    if (onClose) onClose();
                  }
                }}
                className={`text-sm font-semibold leading-tight ${!targetUser?.is_group ? "cursor-pointer hover:underline" : ""}`}
              >
                {targetUser?.name}
              </span>
              {targetUser?.is_group ? (
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Nhóm chat
                </span>
              ) : targetUser && onlineUsers.has(targetUser.id) ? (
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
            {!targetUser?.is_group && (
              <>
                <button
                  onClick={() => startCall("voice")}
                  className="p-2 transition-colors rounded-full hover:bg-secondary text-muted-foreground"
                >
                  <Phone size={20} />
                </button>
                <button
                  onClick={() => startCall("video")}
                  className="p-2 transition-colors rounded-full hover:bg-secondary text-muted-foreground"
                >
                  <Video size={20} />
                </button>
              </>
            )}
            <button
              onClick={() => {
                setIsSettingsOpen(true);
                setSettingsView("menu");
                setChatSearchQuery("");
              }}
              className="p-2 transition-colors rounded-full hover:bg-secondary text-muted-foreground"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* SETTINGS HEADER */}
        <div
          className={`absolute inset-0 flex items-center justify-between p-4 transition-all duration-300 bg-white dark:bg-[#262626] z-30 ${isSettingsOpen ? "translate-x-0 opacity-100 visible pointer-events-auto" : "translate-x-full opacity-0 invisible pointer-events-none"}`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (settingsView === "menu") setIsSettingsOpen(false);
                else setSettingsView("menu");
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-[16px]">
              {settingsView === "menu" && "Cài đặt chung"}
              {settingsView === "search" && "Tìm kiếm tin nhắn"}
              {settingsView === "members" && "Thành viên nhóm"}
              {settingsView === "edit_name" && "Chỉnh sửa nhóm"}
              {settingsView === "edit_nickname" && "Đổi tên gợi nhớ"}
            </span>
          </div>
        </div>
      </div>

      {/* BODY & INPUT WRAPPER */}
      <div className="flex-1 relative overflow-hidden flex flex-col w-full">
        {/* LIST PANEL */}
        <div
          className={`absolute inset-0 flex flex-col transition-all duration-300 z-10 bg-white dark:bg-[#262626] ${targetUser ? "-translate-x-full opacity-0 invisible pointer-events-none" : "translate-x-0 opacity-100 visible pointer-events-auto"}`}
        >
          <div
            className="flex-1 overflow-y-auto p-3 space-y-2 bg-white dark:bg-[#262626]"
            onClick={() => setOpenMessageMenuId(null)}
          >
            {isCreatingGroup ? (
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
            ) : isBlockedListOpen ? (
              <div className="space-y-2">
                {blockedUsersList.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground mt-8">
                    Không có người dùng nào bị chặn.
                  </p>
                ) : (
                  blockedUsersList.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 shadow-sm rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            u.avatar_url ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                          }
                          className="w-10 h-10 rounded-full border border-gray-200 dark:border-neutral-700"
                        />
                        <span className="font-semibold text-sm">{u.name}</span>
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
                <div className="flex justify-between items-center px-1 mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Gần đây
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsBlockedListOpen(true);
                        handleLoadBlockedUsers();
                      }}
                      className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Ban size={14} /> Bị chặn
                    </button>
                    <button
                      onClick={() => setIsCreatingGroup(true)}
                      className="text-xs text-blue-500 font-bold hover:underline flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Users size={14} /> Tạo nhóm mới
                    </button>
                  </div>
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
                      <p
                        className={`text-sm truncate ${c.has_unread ? "font-bold text-gray-900 dark:text-gray-100" : "font-semibold"}`}
                      >
                        {c.otherUser?.name}
                      </p>
                      <p
                        className={`text-xs truncate ${c.has_unread ? "font-bold text-gray-900 dark:text-gray-100" : "text-muted-foreground"}`}
                      >
                        {c.display_last_message || "Bắt đầu chat"}
                      </p>
                    </div>
                    {c.has_unread && (
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mr-1"></div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* SETTINGS PANEL */}
        <div
          className={`absolute inset-0 flex flex-col transition-all duration-300 z-30 bg-gray-50 dark:bg-[#333333] ${isSettingsOpen ? "translate-x-0 opacity-100 visible pointer-events-auto" : "translate-x-full opacity-0 invisible pointer-events-none"}`}
        >
          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {settingsView === "menu" && (
              <>
                <div className="flex flex-col items-center justify-center py-6">
                  <img
                    src={targetUser?.avatar_url}
                    onClick={() => {
                      if (!targetUser?.is_group) {
                        router.push(`/profile/${targetUser?.id}`);
                        if (onClose) onClose();
                      }
                    }}
                    className={`w-20 h-20 rounded-full mb-3 shadow-md border-2 border-white dark:border-[#262626] ${!targetUser?.is_group ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                  />
                  <span
                    onClick={() => {
                      if (!targetUser?.is_group) {
                        router.push(`/profile/${targetUser?.id}`);
                        if (onClose) onClose();
                      }
                    }}
                    className={`font-bold text-xl ${!targetUser?.is_group ? "cursor-pointer hover:underline" : ""}`}
                  >
                    {targetUser?.name}
                  </span>
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
                  {targetUser && !targetUser.is_group && (
                    <>
                      <button
                        onClick={() => {
                          setNewNickname(targetUser.name);
                          setSettingsView("edit_nickname");
                        }}
                        className="w-full flex items-center gap-3 p-3.5 hover:bg-secondary transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
                      >
                        <div className="bg-gray-100 dark:bg-[#333333] p-2 rounded-full">
                          <Edit3 size={18} />
                        </div>{" "}
                        Đổi tên gợi nhớ
                      </button>
                      <button
                        onClick={() => {
                          showConfirm(
                            "Bạn có chắc chắn muốn chặn người dùng này? Hai người sẽ không thể thấy tin nhắn của nhau.",
                            async () => {
                              try {
                                await blockUser(userId, targetUser!.id);
                                toast.success("Đã chặn người dùng");
                                setTargetUser(null);
                                setConversationId(null);
                                setIsSettingsOpen(false);
                                loadConversations();
                              } catch (e) {
                                toast.error("Lỗi khi chặn người dùng");
                              }
                            },
                          );
                        }}
                        className="w-full flex items-center gap-3 p-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors text-[15px] font-semibold border-b border-gray-200 dark:border-neutral-800"
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
                    (newGroupName.trim() === targetUser?.name &&
                      !newGroupAvatar)
                  }
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
                    src={targetUser?.avatar_url}
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-neutral-700 shadow-sm"
                    alt="User Avatar"
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
                        userId,
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

        {/* CHAT PANEL */}
        <div
          className={`absolute inset-0 flex flex-col transition-all duration-300 z-20 bg-white dark:bg-[#262626] ${!targetUser ? "translate-x-full opacity-0 invisible pointer-events-none" : isSettingsOpen ? "-translate-x-full opacity-0 invisible pointer-events-none" : "translate-x-0 opacity-100 visible pointer-events-auto"}`}
        >
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2"
            onClick={() => setOpenMessageMenuId(null)}
          >
            {messages.map((m, index) => {
              const isLastMessage = index === messages.length - 1;
              const dateSeparator = formatMessageDate(
                m.created_at,
                index > 0 ? messages[index - 1].created_at : undefined,
              );

              return (
                <div key={m.id} id={`msg-${m.id}`} className="flex flex-col">
                  {dateSeparator && (
                    <div className="text-center text-[11px] text-muted-foreground my-3 font-medium">
                      {dateSeparator}
                    </div>
                  )}
                  <div
                    className={`flex w-full gap-2 ${m.sender_id === userId ? "justify-end" : "justify-start"} group relative items-end mb-1`}
                  >
                    {m.sender_id === userId && (
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
                                  m.id === openMessageMenuId ? null : m.id,
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
                              <CheckCheck size={14} className="text-blue-500" />
                            ) : (
                              <Check size={14} />
                            )}
                          </span>
                          <span>
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-[15px] max-w-[75%] break-words flex flex-col relative
              ${m.sender_id === userId ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 dark:bg-[#333333] border border-transparent dark:border-neutral-700 text-gray-900 dark:text-gray-100 shadow-sm"}
            `}
                    >
                      {m.reply_to_id && (
                        <div
                          className={`mb-2 border-l-4 border-current px-2 py-1.5 rounded-r text-xs cursor-pointer opacity-90 hover:opacity-100 transition-opacity ${m.sender_id === userId ? "bg-white/20" : "bg-black/5 dark:bg-white/10"}`}
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
                                    (repliedMsg.sender_id === userId
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
                          className={`flex items-center gap-3 p-2 rounded-lg mt-2 cursor-pointer transition-colors border ${m.sender_id === userId ? "bg-white/20 hover:bg-white/30 border-white/30" : "bg-white dark:bg-[#262626] hover:bg-gray-50 dark:hover:bg-[#333333] border-gray-200 dark:border-neutral-700"}`}
                        >
                          <div
                            className={`p-2 rounded-lg ${m.sender_id === userId ? "bg-white/30 text-white" : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"}`}
                          >
                            <FileText size={20} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13px] font-semibold truncate max-w-[150px]">
                              {m.file_name || "Tệp đính kèm"}
                            </span>
                            <span className="text-[10px] opacity-80">
                              {m.file_size
                                ? (m.file_size / 1024 / 1024).toFixed(2) + " MB"
                                : ""}
                            </span>
                          </div>
                          <Download size={16} className="ml-2 opacity-80" />
                        </a>
                      )}
                    </div>
                    {m.sender_id !== userId && (
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
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    )}
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
          </div>

          {/* INPUT */}
          {targetUser?.is_group ||
          (targetUser && followedIds.has(targetUser.id)) ||
          messages.length > 0 ? (
            <div className="flex flex-col bg-white dark:bg-[#262626] border-t border-gray-200 dark:border-neutral-800 transition-colors duration-500 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] dark:shadow-black/20">
              {replyingTo && (
                <div className="p-3 pb-0">
                  <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 border-l-4 border-blue-500 p-2 rounded-r-lg">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-blue-500">
                        Đang trả lời{" "}
                        {replyingTo.users?.name ||
                          (replyingTo.sender_id === userId
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
                <div className="p-3 pb-0 relative inline-block">
                  <div className="relative inline-block">
                    <img
                      src={URL.createObjectURL(imageFile)}
                      alt="preview"
                      className="h-16 rounded-lg object-cover border border-gray-200 dark:border-neutral-700"
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
                <div className="p-3 pb-0 relative inline-block">
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
              <div className="p-3 flex gap-2 items-center">
                <label className="cursor-pointer text-gray-500 hover:text-blue-500 transition-colors p-1">
                  <Paperclip size={22} />
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
                <label className="cursor-pointer text-gray-500 hover:text-blue-500 transition-colors p-1">
                  <ImageIcon size={22} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </label>
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
                  disabled={!text.trim() && !imageFile && !fileAttachment}
                  className="bg-blue-500 hover:bg-blue-600 transition-colors text-white px-3 py-2 rounded-xl disabled:opacity-50 flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 text-center bg-gray-50 dark:bg-[#333333]">
              <p className="text-sm text-muted-foreground font-medium">
                Bạn cần theo dõi người dùng này để bắt đầu trò chuyện.
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Loader2 className="animate-spin text-primary" />
        </div>
      )}

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
                userID={currentUser?.id || userId}
                userName={currentUser?.name || "Người dùng"}
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
