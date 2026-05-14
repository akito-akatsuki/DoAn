"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import ChatBox from "@/components/ChatBox";
import {
  Heart,
  MessageCircle,
  MessageSquare,
  X,
  UserPlus,
  MoreHorizontal,
  Smile,
  Image as ImageIcon,
  ShieldAlert,
  CheckCircle,
  Trash2,
  Flag,
  Maximize,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getComments,
  createComment,
  deleteComment,
  updateComment,
  toggleLike,
  submitAppeal,
  deleteNotification,
  reportComment,
} from "@/lib/api";
import { showConfirm } from "@/components/GlobalConfirm";

export default function NotificationsPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [modalCommentText, setModalCommentText] = useState("");
  const [modalCommentFile, setModalCommentFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  // ================= REPORT =================
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  // ================= APPEAL POST =================
  const [appealPostId, setAppealPostId] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);

  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const modalInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isChatOpen &&
        chatContainerRef.current &&
        !chatContainerRef.current.contains(e.target as Node)
      ) {
        setIsChatOpen(false);
      }
      setOpenCommentMenuId(null);

      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isChatOpen, openCommentMenuId, showEmojiPicker]);

  // ================= CHẶN LƯỚT BACKGROUND KHI MỞ MODAL =================
  useEffect(() => {
    if (selectedPost) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPost]);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;

      if (currentUser) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", currentUser.id)
          .single();
        setUser({ ...currentUser, ...(dbUser || {}) });
        await loadNotifications(currentUser.id);
      }
    } catch (err) {
      console.error("Lỗi khởi tạo trang thông báo:", err);
    }
  };

  const loadNotifications = async (userId: string) => {
    setLoading(true);

    // Nhờ Supabase Database lọc sẵn: Chỉ lấy thông báo KHÁC userId và KHÔNG BỊ NULL
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("notifications error:", JSON.stringify(error, null, 2));
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Lọc bỏ thông báo do chính mình tạo ra (nhưng giữ lại system_alert do Admin gửi)
    const validData = data.filter(
      (n) =>
        n.type === "system_alert" ||
        n.type === "system_success" ||
        (n.sender_id && n.sender_id !== userId),
    );

    // Tải riêng thông tin của những "người gửi"
    const senderIds = Array.from(
      new Set(validData.map((n) => n.sender_id).filter(Boolean)),
    );
    const postIds = Array.from(
      new Set(validData.map((n) => n.post_id).filter(Boolean)),
    );

    let usersData: any[] = [];
    if (senderIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .in("id", senderIds);
      if (users) usersData = users;
    }

    let postsData: any[] = [];
    if (postIds.length > 0) {
      const { data: posts } = await supabase
        .from("posts")
        .select("id, image_url, content")
        .in("id", postIds);
      if (posts) postsData = posts;
    }

    // Ghép thông tin Avatar, Name vào từng thông báo
    const enrichedNotifications = validData.map((n) => {
      const senderInfo = usersData.find((u) => u.id === n.sender_id);
      const postInfo = postsData.find((p) => p.id === n.post_id);
      return {
        ...n,
        users: senderInfo || null,
        posts: postInfo || null,
      };
    });

    setNotifications(enrichedNotifications);
    setLoading(false);

    // TỰ ĐỘNG ĐÁNH DẤU ĐÃ ĐỌC KHI MỞ TRANG
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  };

  const openPostModal = async (postId: string) => {
    if (!postId) return;

    try {
      const { data: postData, error } = await supabase
        .from("posts")
        .select("*, users:user_id(id, name, avatar_url)")
        .eq("id", postId)
        .single();

      if (error || !postData) {
        toast.error("Bài viết này không tồn tại hoặc đã bị xóa!");
        return;
      }

      const { count: likeCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);

      let isLiked = false;
      if (user) {
        const { data: likeData } = await supabase
          .from("likes")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .maybeSingle();
        isLiked = !!likeData;
      }

      let commentsData = [];
      try {
        commentsData = (await getComments(postId)) || [];
      } catch (err) {
        console.error("Lỗi lấy bình luận:", err);
      }

      setSelectedPost({
        ...postData,
        likes_count: likeCount || 0,
        is_liked: isLiked,
      });
      setModalComments(commentsData);
    } catch (err) {
      console.error("Lỗi mở modal:", err);
      toast.error("Đã xảy ra lỗi khi tải bài viết.");
    }
  };

  const closeModal = () => {
    setSelectedPost(null);
    setModalComments([]);
    setModalCommentText("");
    setModalCommentFile(null);
    setOpenCommentMenuId(null);
    setEditingCommentId(null);
    setShowEmojiPicker(false);
    setExpandedReplies({});
  };

  // ================= DELETE NOTIFICATION =================
  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Ngăn sự kiện mở modal/chuyển trang

    // Kích hoạt hiệu ứng trượt và mờ
    setDeletingIds((prev) => [...prev, id]);

    setTimeout(async () => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setDeletingIds((prev) => prev.filter((deletingId) => deletingId !== id));
      try {
        await deleteNotification(id);
      } catch (err) {
        toast.error("Xóa thông báo thất bại");
      }
    }, 300); // 300ms khớp với duration của transition
  };

  // ================= APPEAL POST =================
  const handleSubmitAppeal = async () => {
    if (!appealPostId || !appealReason.trim()) return;
    try {
      await submitAppeal(appealPostId, appealReason);
      toast.success(
        "Đã gửi yêu cầu xem xét lại! Quản trị viên sẽ phản hồi bạn sớm nhất.",
      );
      setAppealPostId(null);
      setAppealReason("");
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi gửi yêu cầu.");
    }
  };

  // ================= REPORT =================
  const handleReportComment = (commentId: string) => {
    if (!user) return;
    setReportTargetId(commentId);
    setReportReason("");
    setOpenCommentMenuId(null);
  };

  const submitReport = async () => {
    if (!reportTargetId || !reportReason.trim()) return;
    try {
      await reportComment(reportTargetId, reportReason);
      toast.success("Đã gửi báo cáo bình luận thành công!");
      setReportTargetId(null);
      setReportReason("");
    } catch (err) {
      console.error("LỖI BÁO CÁO BÌNH LUẬN:", err);
      toast.error("Đã xảy ra lỗi khi báo cáo.");
    }
  };

  const handleLike = async (postId: string) => {
    if (!user || !selectedPost) return;

    const currentlyLiked = selectedPost.is_liked;
    setSelectedPost((prev: any) => ({
      ...prev,
      is_liked: !currentlyLiked,
      likes_count: !currentlyLiked
        ? (prev.likes_count || 0) + 1
        : Math.max(0, (prev.likes_count || 0) - 1),
    }));

    try {
      const res = await toggleLike(postId);
      setSelectedPost((prev: any) => ({
        ...prev,
        is_liked: res.is_liked,
        likes_count:
          (res as any).likes !== undefined
            ? (res as any).likes
            : res.likes_count,
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const handleModalComment = async () => {
    const text = modalCommentText;
    const file = modalCommentFile;
    if (!user || (!text.trim() && !file) || !selectedPost) return;
    setModalCommentText("");
    setModalCommentFile(null);
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      image_url: file ? URL.createObjectURL(file) : null,
      user_id: user.id,
      users: {
        id: user.id,
        name:
          user.name ||
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          "Bạn",
        avatar_url: user.avatar_url || user.user_metadata?.avatar_url,
      },
    };
    setModalComments((prev) => [...prev, tempComment]);
    try {
      let imageUrl = null;
      if (file) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `comment_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("comment_images")
          .upload(fileName, file);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("comment_images")
            .getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        }
      }
      const newCmt = await createComment(selectedPost.id, text, imageUrl);
      setModalComments((prev) =>
        prev.map((c) => (c.id === tempId ? newCmt : c)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleModalReplyClick = (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!username) return;
    const newText = modalCommentText.startsWith(`@${username} `)
      ? modalCommentText
      : `@${username} ${modalCommentText}`;
    setModalCommentText(newText);
    setTimeout(() => modalInputRef.current?.focus(), 50);
  };

  const handleDeleteComment = async (commentId: string) => {
    showConfirm("Bạn có chắc chắn muốn xóa bình luận này?", async () => {
      try {
        await deleteComment(commentId);
        setModalComments((prev) => prev.filter((c) => c.id !== commentId));
        setOpenCommentMenuId(null);
      } catch (err) {
        console.error(err);
        toast.error("Xóa bình luận thất bại.");
      }
    });
  };

  const submitEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editCommentText);
      setModalComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c)),
      );
      setEditingCommentId(null);
      setOpenCommentMenuId(null);
    } catch (err) {
      console.error(err);
      toast.error("Sửa bình luận thất bại.");
    }
  };

  const iconMap: any = {
    like: <Heart className="text-red-500 w-4 h-4 fill-red-500" />,
    comment: <MessageCircle className="text-blue-500 w-4 h-4 fill-blue-500" />,
    follow: <UserPlus className="text-green-500 w-4 h-4" />,
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[600px] mx-auto pt-24 px-4 pb-28 md:pb-20">
        <h1 className="text-2xl font-bold mb-6">Thông báo</h1>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted"></div>
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            Bạn chưa có thông báo nào.
          </div>
        )}

        <div className="space-y-2 overflow-x-hidden pb-2">
          {notifications.map((n) => {
            if (n.type === "system_alert") {
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.post_id) {
                      openPostModal(n.post_id);
                    }
                  }}
                  className={`group flex items-start gap-4 p-4 rounded-xl transition-all duration-300 border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20 ${!n.is_read ? "shadow-sm" : ""} ${deletingIds.includes(n.id) ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}
                >
                  <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6 text-red-500 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-red-500 dark:text-red-400 mb-1">
                      Cảnh báo hệ thống
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {n.content}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-2">
                      {new Date(
                        n.created_at.includes("Z") || n.created_at.includes("+")
                          ? n.created_at
                          : `${n.created_at}Z`,
                      ).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button
                      onClick={(e) => handleDeleteNotification(n.id, e)}
                      className="p-2 text-red-400 hover:text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            }

            if (n.type === "system_success") {
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.post_id) {
                      openPostModal(n.post_id);
                    }
                  }}
                  className={`group flex items-start gap-4 p-4 rounded-xl transition-all duration-300 border border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20 ${!n.is_read ? "shadow-sm" : ""} ${deletingIds.includes(n.id) ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}
                >
                  <div className="w-11 h-11 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-green-500 dark:text-green-400 mb-1">
                      Thông báo hệ thống
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {n.content}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-2">
                      {new Date(
                        n.created_at.includes("Z") || n.created_at.includes("+")
                          ? n.created_at
                          : `${n.created_at}Z`,
                      ).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button
                      onClick={(e) => handleDeleteNotification(n.id, e)}
                      className="p-2 text-green-500 hover:text-green-700 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={n.id}
                onClick={() => {
                  const type = n.type?.toLowerCase().trim();
                  if (type === "like" || type === "comment") {
                    if (n.post_id) {
                      openPostModal(n.post_id);
                    } else if (n.sender_id) {
                      router.push(`/profile/${n.sender_id}`);
                    }
                  } else if (type === "follow") {
                    if (n.sender_id) {
                      router.push(`/profile/${n.sender_id}`);
                    }
                  } else {
                    // Dự phòng cho các loại thông báo khác
                    if (n.post_id) openPostModal(n.post_id);
                    else if (n.sender_id)
                      router.push(`/profile/${n.sender_id}`);
                  }
                }}
                className={`group flex items-center gap-4 p-3 rounded-xl transition-all duration-300 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-neutral-800 hover:shadow-sm dark:hover:shadow-black/40 hover:bg-white dark:hover:bg-[#262626] ${!n.is_read ? "bg-blue-50 dark:bg-[#333333]" : ""} ${deletingIds.includes(n.id) ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}
              >
                <div className="relative">
                  <img
                    src={
                      n.users?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${n.user_id}`
                    }
                    className="w-11 h-11 rounded-full object-cover ring-1 ring-gray-200 dark:ring-neutral-700 shadow-sm"
                  />
                  <div className="absolute -bottom-1 -right-1 rounded-full p-1 border border-gray-200 dark:border-neutral-700 shadow-sm bg-white dark:bg-[#262626]">
                    {iconMap[n.type] || (
                      <Heart className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight text-foreground">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {n.users?.name || "Người dùng"}
                    </span>{" "}
                    {n.type === "like" && "đã thích bài viết của bạn."}
                    {n.type === "comment" &&
                      "đã bình luận về bài viết của bạn."}
                    {n.type === "follow" && "đã bắt đầu theo dõi bạn."}
                  </p>

                  <p className="text-[12px] text-muted-foreground mt-1">
                    {new Date(
                      n.created_at.includes("Z") || n.created_at.includes("+")
                        ? n.created_at
                        : `${n.created_at}Z`,
                    ).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>

                {/* HIỂN THỊ THUMBNAIL CỦA BÀI VIẾT Ở BÊN PHẢI */}
                {n.posts && (
                  <div className="flex-shrink-0 ml-2">
                    {n.posts.image_url ? (
                      <img
                        src={n.posts.image_url}
                        className="w-12 h-12 object-cover rounded-md border border-gray-200 dark:border-neutral-700 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 overflow-hidden bg-gray-100 dark:bg-[#333333] text-[9px] p-1 text-muted-foreground rounded-md flex items-center justify-center text-center border border-gray-200 dark:border-neutral-700 shadow-sm break-words line-clamp-3">
                        {n.posts.content}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-shrink-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button
                    onClick={(e) => handleDeleteNotification(n.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ================= MODAL POST ================= */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#262626]/95 p-4 md:p-10 cursor-pointer transition-all"
          onClick={closeModal}
        >
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-[10000] p-2"
          >
            <X className="w-8 h-8" />
          </button>

          <div
            className={`text-gray-900 dark:text-gray-100 flex flex-col md:flex-row w-full ${selectedPost.image_url ? "max-w-5xl" : "max-w-xl"} max-h-[90vh] rounded-xl overflow-hidden shadow-2xl dark:shadow-black/60 relative animate-in fade-in zoom-in-95 duration-200 cursor-default transition-colors duration-500 bg-white dark:bg-[#262626]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Phần Ảnh */}
            {selectedPost.image_url && (
              <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center min-h-[300px] md:min-h-[500px] relative overflow-hidden">
                <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center min-h-[300px] md:min-h-[500px] relative overflow-hidden group">
                  <img
                    src={selectedPost.image_url}
                    className={`w-full h-full object-cover object-center ${selectedPost.is_flagged ? "blur-xl scale-110" : ""}`}
                    alt="Post"
                  />
                  {!selectedPost.is_flagged && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingImage(selectedPost.image_url);
                        setImageScale(1);
                      }}
                      className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md"
                    >
                      <Maximize size={20} />
                    </button>
                  )}
                  {selectedPost.is_flagged && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/30 z-20 pointer-events-none">
                      <ShieldAlert className="w-12 h-12 mb-2 text-red-500 drop-shadow-md" />
                      <span className="font-bold text-lg drop-shadow-md">
                        Hình ảnh nhạy cảm
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Phần Thông tin / Bình luận */}
            <div
              className={`w-full flex flex-col h-[50vh] md:h-auto transition-colors duration-500 bg-white dark:bg-[#262626] ${selectedPost.image_url ? "md:w-[400px] border-l border-gray-200 dark:border-neutral-800" : "md:min-h-[500px]"}`}
            >
              {/* Header & Content */}
              <div className="flex flex-col border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333]">
                {/* Header */}
                <div className="flex items-center gap-3 p-4 pb-2">
                  <img
                    src={
                      selectedPost.users?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedPost.users?.id}`
                    }
                    className="w-10 h-10 rounded-full border object-cover"
                    alt="avatar"
                  />
                  <span className="font-semibold text-sm">
                    {selectedPost.users?.name || "Người dùng"}
                  </span>
                </div>

                {/* Caption */}
                {(selectedPost.content || selectedPost.is_flagged) && (
                  <div
                    className={`px-4 pb-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 ${selectedPost.is_flagged ? "text-red-500 font-semibold italic" : ""}`}
                  >
                    {selectedPost.is_flagged
                      ? "Nội dung này đã bị ẩn do vi phạm tiêu chuẩn cộng đồng."
                      : selectedPost.content}
                    {selectedPost.is_flagged &&
                      user?.id === selectedPost.user_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAppealPostId(selectedPost.id);
                          }}
                          className="block mt-2 text-blue-500 hover:underline text-[12px] font-bold not-italic"
                        >
                          Gửi yêu cầu xem xét lại (Kháng nghị)
                        </button>
                      )}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {(() => {
                  const items: any[] = [];
                  let tempReplies: any[] = [];
                  modalComments.forEach((c: any) => {
                    const isReply = c.content?.trim().startsWith("@");
                    if (isReply) {
                      tempReplies.push(c);
                    } else {
                      if (tempReplies.length > 0) {
                        items.push({ type: "replies", data: tempReplies });
                        tempReplies = [];
                      }
                      items.push({ type: "comment", data: c });
                    }
                  });
                  if (tempReplies.length > 0) {
                    items.push({ type: "replies", data: tempReplies });
                  }

                  const renderComment = (c: any, isReply: boolean) => (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 group relative cursor-pointer ${
                        isReply ? "ml-10 mt-1" : "mt-4"
                      }`}
                      onDoubleClick={(e) =>
                        handleModalReplyClick(c.users?.name, e)
                      }
                    >
                      <img
                        src={
                          c.users?.avatar_url ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`
                        }
                        className={`${
                          isReply ? "w-7 h-7" : "w-10 h-10"
                        } rounded-full border object-cover flex-shrink-0`}
                        alt="avatar"
                      />
                      <div className={`${isReply ? "mt-0" : "mt-1"} flex-1`}>
                        <span
                          className={`font-semibold mr-2 ${
                            isReply ? "text-xs" : "text-sm"
                          }`}
                        >
                          {c.users?.name || "Người dùng"}
                        </span>
                        {editingCommentId === c.id ? (
                          <div className="flex flex-col gap-1 mt-1">
                            <input
                              className="border border-gray-200 dark:border-neutral-700 px-2 py-1 rounded-lg w-full outline-none text-sm bg-transparent"
                              value={editCommentText}
                              onChange={(e) =>
                                setEditCommentText(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submitEditComment(c.id);
                                if (e.key === "Escape")
                                  setEditingCommentId(null);
                              }}
                              autoFocus
                            />
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => submitEditComment(c.id)}
                                className="text-blue-500 font-semibold"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={() => setEditingCommentId(null)}
                                className="text-muted-foreground"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span
                              className={`whitespace-pre-wrap ${
                                isReply
                                  ? "text-[13px] text-muted-foreground"
                                  : "text-sm"
                              }`}
                            >
                              {c.content}
                            </span>
                            {c.image_url && (
                              <img
                                src={c.image_url}
                                alt="comment-img"
                                className="mt-1 max-h-32 rounded-lg object-contain border border-gray-200 dark:border-neutral-700"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {user && !editingCommentId && (
                        <div className="relative opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2 mt-1">
                          <MoreHorizontal
                            className="w-4 h-4 cursor-pointer text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCommentMenuId(
                                openCommentMenuId === c.id ? null : c.id,
                              );
                            }}
                          />
                          {openCommentMenuId === c.id && (
                            <div className="absolute right-0 mt-1 w-24 border border-gray-200 dark:border-neutral-700 shadow-lg dark:shadow-black/50 rounded-lg py-1 z-50 transition-colors duration-500 bg-white dark:bg-[#333333]">
                              {user.id === c.user_id ? (
                                <>
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setEditingCommentId(c.id);
                                      setEditCommentText(c.content);
                                      setOpenCommentMenuId(null);
                                    }}
                                    className="w-full text-left px-3 py-1 text-sm hover:bg-secondary"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteComment(c.id);
                                    }}
                                    className="w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-secondary"
                                  >
                                    Xóa
                                  </button>
                                </>
                              ) : (
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleReportComment(c.id);
                                  }}
                                  className="w-full text-left px-3 py-1 text-sm hover:bg-secondary flex items-center gap-2"
                                >
                                  <Flag size={14} /> Báo cáo
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );

                  return items.map((item, idx) => {
                    if (item.type === "comment") {
                      return renderComment(item.data, false);
                    } else {
                      const replies = item.data;
                      if (replies.length === 1) {
                        return renderComment(replies[0], true);
                      } else {
                        const groupId = replies[0].id;
                        const isExpanded = expandedReplies[groupId];
                        return (
                          <div key={`group-${groupId}`} className="space-y-4">
                            {!isExpanded ? (
                              <div
                                className="ml-10 mt-1 flex items-center gap-3 cursor-pointer group"
                                onClick={() =>
                                  setExpandedReplies((prev) => ({
                                    ...prev,
                                    [groupId]: true,
                                  }))
                                }
                              >
                                <div className="w-8 h-[1px] bg-gray-400 dark:bg-gray-600"></div>
                                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                                  Xem {replies.length} câu trả lời từ{" "}
                                  {replies[0].users?.name || "Người dùng"}
                                </span>
                              </div>
                            ) : (
                              replies.map((c: any) => renderComment(c, true))
                            )}
                          </div>
                        );
                      }
                    }
                  });
                })()}
              </div>

              {/* Action / Input */}
              <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <Heart
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(selectedPost.id);
                    }}
                    className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${
                      (selectedPost.is_liked ?? false)
                        ? "text-red-500 fill-red-500"
                        : "stroke-[2px] text-gray-900 dark:text-gray-100"
                    }`}
                  />
                  <span className="font-semibold text-sm">
                    {selectedPost.likes_count || 0} lượt thích
                  </span>
                </div>
                <div
                  ref={emojiPickerRef}
                  className="flex items-center gap-2 mt-3 border border-gray-200 dark:border-neutral-700 shadow-inner rounded-full px-3 py-1 bg-gray-50 dark:bg-[#333333] focus-within:bg-white dark:focus-within:bg-[#262626] transition-colors relative"
                >
                  <Smile
                    className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  />
                  {showEmojiPicker && (
                    <div className="absolute bottom-12 left-0 bg-white dark:bg-[#333333] border border-gray-200 dark:border-neutral-700 shadow-xl rounded-xl p-3 w-64 z-[99999]">
                      <div className="grid grid-cols-5 gap-3 text-xl">
                        {[
                          "😀",
                          "😂",
                          "😍",
                          "🥰",
                          "😊",
                          "😎",
                          "😢",
                          "😭",
                          "😡",
                          "👍",
                          "❤️",
                          "🔥",
                          "✨",
                          "🎉",
                          "🙌",
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            className="hover:scale-125 transition-transform"
                            onClick={() => {
                              setModalCommentText((prev) => prev + emoji);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <input
                    ref={modalInputRef}
                    className="flex-1 px-2 py-1.5 text-sm outline-none bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
                    value={modalCommentText}
                    onChange={(e) => setModalCommentText(e.target.value)}
                    placeholder="Thêm bình luận..."
                    onKeyDown={(e) => e.key === "Enter" && handleModalComment()}
                  />
                  {modalCommentFile && (
                    <div className="relative">
                      <img
                        src={URL.createObjectURL(modalCommentFile)}
                        className="h-8 w-8 object-cover rounded border border-gray-200 dark:border-neutral-700"
                      />
                      <button
                        onClick={() => setModalCommentFile(null)}
                        className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer text-gray-500 hover:text-blue-500 p-1">
                    <ImageIcon size={18} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        setModalCommentFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                  <button
                    onClick={handleModalComment}
                    disabled={!modalCommentText.trim() && !modalCommentFile}
                    className="text-blue-500 font-semibold text-sm disabled:opacity-50 px-2"
                  >
                    Đăng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL REPORT ================= */}
      {reportTargetId && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setReportTargetId(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Báo cáo bình luận
              </h3>
              <button
                onClick={() => setReportTargetId(null)}
                className="hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Vui lòng nhập lý do báo cáo bình luận này. Quản trị viên sẽ xem
                xét báo cáo của bạn.
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Ví dụ: Nội dung phản cảm, spam..."
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors resize-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] text-sm text-gray-900 dark:text-gray-100"
                rows={4}
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors rounded-lg"
                onClick={() => setReportTargetId(null)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors rounded-lg disabled:opacity-50"
                onClick={submitReport}
                disabled={!reportReason.trim()}
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL APPEAL POST ================= */}
      {appealPostId && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setAppealPostId(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Gửi yêu cầu xem xét lại
              </h3>
              <button
                onClick={() => setAppealPostId(null)}
                className="hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Vui lòng nhập lý do bạn cho rằng bài viết này không vi phạm tiêu
                chuẩn cộng đồng.
              </p>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Ví dụ: Hình ảnh này chỉ là ảnh nghệ thuật, không có yếu tố phản cảm..."
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors resize-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] text-sm text-gray-900 dark:text-gray-100"
                rows={4}
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors rounded-lg"
                onClick={() => setAppealPostId(null)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors rounded-lg disabled:opacity-50"
                onClick={handleSubmitAppeal}
                disabled={!appealReason.trim()}
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL XEM ẢNH FULL MÀN HÌNH ================= */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[9999999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setViewingImage(null);
            setImageScale(1);
          }}
        >
          <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
            <div className="flex items-center gap-2 bg-black/50 rounded-full px-2 py-1 shadow-md">
              <button
                className="text-white hover:text-gray-300 p-2 transition-colors disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageScale((prev) => Math.max(0.5, prev - 0.25));
                }}
                disabled={imageScale <= 0.5}
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-white text-xs font-mono w-10 text-center select-none">
                {Math.round(imageScale * 100)}%
              </span>
              <button
                className="text-white hover:text-gray-300 p-2 transition-colors disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageScale((prev) => Math.min(3, prev + 0.25));
                }}
                disabled={imageScale >= 3}
              >
                <ZoomIn size={20} />
              </button>
            </div>
            <button
              className="text-white hover:text-gray-300 p-2 bg-black/50 rounded-full transition-colors shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                setViewingImage(null);
                setImageScale(1);
              }}
            >
              <X size={24} />
            </button>
          </div>
          <div
            className="w-full h-full overflow-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewingImage}
              alt="fullscreen-img"
              className="max-w-full max-h-screen object-contain rounded-xl shadow-2xl transition-transform duration-200"
              style={{ transform: `scale(${imageScale})` }}
            />
          </div>
        </div>
      )}

      {/* FIXED CHAT UI */}
      <div
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[999] flex flex-col items-end gap-4"
        ref={chatContainerRef}
      >
        {user && (
          <div
            className={`w-[380px] h-[550px] text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl dark:shadow-black/50 border border-gray-200 dark:border-neutral-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 transition-colors duration-500 bg-white dark:bg-[#262626] ${isChatOpen ? "flex flex-col" : "hidden"}`}
          >
            <ChatBox userId={user.id} onClose={() => setIsChatOpen(false)} />
          </div>
        )}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`shadow-2xl transition-all active:scale-90 p-4 rounded-full flex items-center justify-center ${
            isChatOpen
              ? "bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-800"
              : "bg-[#0095F6] text-white hover:bg-blue-600"
          }`}
        >
          {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>
      </div>
    </div>
  );
}
