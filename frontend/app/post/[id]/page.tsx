"use client";

import { use, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Heart,
  MoreHorizontal,
  X,
  Trash2,
  Smile,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Flag,
  Maximize,
  ZoomIn,
  ZoomOut,
  Bookmark,
  Pencil,
  Send,
  Link as LinkIcon,
  Share,
  ShieldAlert,
} from "lucide-react";
import {
  getComments,
  createComment,
  deleteComment,
  updateComment,
  toggleLike,
  reportPost,
  reportComment,
  toggleSavePost,
  submitAppeal,
} from "@/lib/api";
import { showConfirm } from "@/components/GlobalConfirm";

export default function SinglePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [commentText, setCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);

  // UI States
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [openPostMenu, setOpenPostMenu] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});

  // Share States
  const [sharePost, setSharePost] = useState<any | null>(null);
  const [shareFriends, setShareFriends] = useState<any[]>([]);
  const [isSharing, setIsSharing] = useState(false);

  // Report States
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"post" | "comment">("post");
  const [reportReason, setReportReason] = useState("");
  const [appealPostId, setAppealPostId] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setOpenCommentMenuId(null);
      setOpenPostMenu(false);
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
  }, [showEmojiPicker]);

  // ================= LOAD DATA =================
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      let currentUser = null;
      if (authUser) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();
        currentUser = { ...authUser, ...(dbUser || {}) };
        setUser(currentUser);
      }

      const { data: postData, error } = await supabase
        .from("posts")
        .select(
          "*, users:user_id(id, name, avatar_url), pages:page_id(id, name, avatar_url)",
        )
        .eq("id", id)
        .single();

      if (error || !postData) {
        toast.error("Bài viết không tồn tại hoặc đã bị xóa!");
        router.push("/");
        return;
      }

      const { count: likeCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", id);

      let isLiked = false;
      let isSaved = false;
      if (currentUser) {
        const { data: likeData } = await supabase
          .from("likes")
          .select("id")
          .eq("post_id", id)
          .eq("user_id", currentUser.id)
          .maybeSingle();
        isLiked = !!likeData;

        const { data: saveData } = await supabase
          .from("saved_posts")
          .select("id")
          .eq("post_id", id)
          .eq("user_id", currentUser.id)
          .maybeSingle();
        isSaved = !!saveData;

        // Fetch friends for sharing
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id);
        if (follows && follows.length > 0) {
          const ids = follows.map((f: any) => f.following_id);
          const { data: users } = await supabase
            .from("users")
            .select("id, name, avatar_url")
            .in("id", ids)
            .limit(10);
          setShareFriends(users || []);
        }
      }

      setPost({
        ...postData,
        likes_count: likeCount || 0,
        is_liked: isLiked,
        is_saved: isSaved,
      });

      const commentsData = await getComments(id);
      setComments(commentsData || []);
      setLoading(false);
    };

    if (id) init();
  }, [id, router]);

  // ================= HANDLERS =================
  const handleLike = async () => {
    if (!user || !post) return;
    const currentlyLiked = post.is_liked;
    setPost((prev: any) => ({
      ...prev,
      is_liked: !currentlyLiked,
      likes_count: !currentlyLiked
        ? (prev.likes_count || 0) + 1
        : Math.max(0, (prev.likes_count || 0) - 1),
    }));
    try {
      const res = await toggleLike(post.id);
      setPost((prev: any) => ({
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

  const handleSavePost = async () => {
    if (!user) return toast.error("Vui lòng đăng nhập!");
    try {
      const { is_saved } = await toggleSavePost(post.id);
      setPost((prev: any) => ({ ...prev, is_saved }));
      toast.success(
        is_saved ? "Đã lưu bài viết thành công!" : "Đã bỏ lưu bài viết!",
      );
      setOpenPostMenu(false);
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi lưu bài viết.");
    }
  };

  const handleDeletePost = async () => {
    showConfirm("Bạn có chắc chắn muốn xóa bài viết này?", async () => {
      try {
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", post.id);
        if (error) throw error;
        toast.success("Xóa bài viết thành công!");
        router.push("/");
      } catch (err) {
        toast.error("Xóa bài viết thất bại.");
      }
    });
  };

  const handleComment = async () => {
    if (!user || (!commentText.trim() && !commentFile) || !post) return;
    const text = commentText;
    const file = commentFile;
    setCommentText("");
    setCommentFile(null);

    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      image_url: file ? URL.createObjectURL(file) : null,
      user_id: user.id,
      users: {
        id: user.id,
        name: user.name || user.user_metadata?.name || "Bạn",
        avatar_url: user.avatar_url || user.user_metadata?.avatar_url,
      },
    };
    setComments((prev) => [...prev, tempComment]);

    try {
      let imageUrl = null;
      if (file) {
        const fileName = `comment_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error } = await supabase.storage
          .from("comment_images")
          .upload(fileName, file);
        if (!error) {
          const { data } = supabase.storage
            .from("comment_images")
            .getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        }
      }
      const newCmt = await createComment(post.id, text, imageUrl);
      setComments((prev) => prev.map((c) => (c.id === tempId ? newCmt : c)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    showConfirm("Bạn có chắc chắn muốn xóa bình luận này?", async () => {
      try {
        await deleteComment(commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setOpenCommentMenuId(null);
      } catch (err) {
        toast.error("Xóa bình luận thất bại.");
      }
    });
  };

  const submitEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editCommentText);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c)),
      );
      setEditingCommentId(null);
      setOpenCommentMenuId(null);
    } catch (err) {
      toast.error("Sửa bình luận thất bại.");
    }
  };

  const handleReplyClick = (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!username) return;
    const newText = commentText.startsWith(`@${username} `)
      ? commentText
      : `@${username} ${commentText}`;
    setCommentText(newText);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSendToFriend = async (friendId: string) => {
    if (!user || isSharing || !sharePost) return;
    setIsSharing(true);
    try {
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      let convId = null;
      if (myParts && myParts.length > 0) {
        const convIds = myParts.map((p) => p.conversation_id);
        const { data: friendParts } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", friendId)
          .in("conversation_id", convIds);
        if (friendParts && friendParts.length > 0) {
          const commonConvIds = friendParts.map((p) => p.conversation_id);
          const { data: convs } = await supabase
            .from("conversations")
            .select("id")
            .in("id", commonConvIds)
            .eq("is_group", false)
            .limit(1);
          if (convs && convs.length > 0) convId = convs[0].id;
        }
      }
      if (!convId) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ is_group: false })
          .select("id")
          .single();
        if (newConv) {
          convId = newConv.id;
          await supabase.from("conversation_participants").insert([
            { conversation_id: convId, user_id: user.id },
            { conversation_id: convId, user_id: friendId },
          ]);
        }
      }
      if (convId) {
        const postUrl = `${window.location.origin}/post/${sharePost.id}`;
        let previewText = `${postUrl}`;
        if (sharePost.content) {
          const truncatedContent =
            sharePost.content.length > 50
              ? sharePost.content.substring(0, 50) + "..."
              : sharePost.content;
          previewText += `\n\n"${truncatedContent}"`;
        }
        const previewImage =
          sharePost.image_urls?.[0] || sharePost.image_url || null;

        await supabase
          .from("messages")
          .insert({
            conversation_id: convId,
            sender_id: user.id,
            content: previewText,
            image_url: previewImage,
          });
        await supabase
          .from("conversations")
          .update({ last_message: `Hãy xem bài viết này...` })
          .eq("id", convId);
        toast.success("Đã gửi cho bạn bè!");
        setSharePost(null);
      }
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi gửi");
    } finally {
      setIsSharing(false);
    }
  };

  const submitReport = async () => {
    if (!reportTargetId || !reportReason.trim()) return;
    try {
      if (reportType === "post") {
        await reportPost(reportTargetId, reportReason);
      } else {
        await reportComment(reportTargetId, reportReason);
      }
      toast.success("Đã gửi báo cáo thành công!");
      setReportTargetId(null);
      setReportReason("");
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi báo cáo.");
    }
  };

  const submitPostAppeal = async () => {
    if (!appealPostId || !appealReason.trim()) return;
    try {
      await submitAppeal(appealPostId, appealReason);
      toast.success("Đã gửi yêu cầu xem xét lại!");
      setAppealPostId(null);
      setAppealReason("");
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi gửi yêu cầu.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-4 bg-gray-50 dark:bg-neutral-900 flex justify-center text-gray-900 dark:text-gray-100">
        Đang tải bài viết...
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen pt-20 md:pt-28 pb-10 px-4 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 flex justify-center items-start transition-colors duration-500">
      <div
        className={`w-full ${post.image_urls?.length > 0 || post.image_url ? "max-w-5xl" : "max-w-xl"} bg-white dark:bg-[#262626] rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-neutral-800 flex flex-col md:flex-row transition-colors duration-500`}
      >
        {/* PHẦN ẢNH BÊN TRÁI (NẾU CÓ) */}
        {(post.image_urls?.length > 0 || post.image_url) && (
          <div
            className={`flex-1 bg-[#1a1a1a] flex items-stretch justify-between relative ${post.image_urls?.length > 1 ? "h-[50vh] md:h-[80vh]" : "min-h-[400px] md:min-h-[600px]"}`}
          >
            {post.image_urls?.length > 1 && (
              <div
                className="w-[12%] md:w-16 shrink-0 flex items-center justify-center z-10 cursor-pointer hover:bg-black/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev <= 0 ? post.image_urls.length - 1 : prev - 1,
                  );
                }}
              >
                <button className="p-2 bg-white/80 hover:bg-white dark:bg-black/50 dark:hover:bg-black/80 rounded-full shadow hover:scale-105 transition-transform">
                  <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-gray-100" />
                </button>
              </div>
            )}
            <div
              className="flex-1 overflow-hidden flex items-center justify-center h-full relative group cursor-pointer"
              onClick={() => {
                setViewingImage(
                  post.image_urls?.[currentImageIndex] || post.image_url,
                );
                setImageScale(1);
              }}
            >
              <img
                src={post.image_urls?.[currentImageIndex] || post.image_url}
                className={`max-w-full max-h-full w-auto h-auto object-contain transition-all duration-300 select-none pointer-events-none ${post.is_flagged ? "blur-xl scale-110" : ""}`}
                alt="Post"
              />
              {!post.is_flagged && (
                <button className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md">
                  <Maximize size={20} />
                </button>
              )}
            </div>
            {post.image_urls?.length > 1 && (
              <div
                className="w-[12%] md:w-16 shrink-0 flex items-center justify-center z-10 cursor-pointer hover:bg-black/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev >= post.image_urls.length - 1 ? 0 : prev + 1,
                  );
                }}
              >
                <button className="p-2 bg-white/80 hover:bg-white dark:bg-black/50 dark:hover:bg-black/80 rounded-full shadow hover:scale-105 transition-transform">
                  <ChevronRight className="w-6 h-6 text-gray-900 dark:text-gray-100" />
                </button>
              </div>
            )}
            {post.image_urls?.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                {post.image_urls.map((_: any, idx: number) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full shadow-sm transition-all duration-300 ${currentImageIndex === idx ? "bg-blue-500 scale-110" : "bg-white/60 dark:bg-black/60"}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* PHẦN NỘI DUNG & BÌNH LUẬN BÊN PHẢI */}
        <div
          className={`w-full flex flex-col h-[60vh] md:h-auto ${post.image_urls?.length > 0 || post.image_url ? "md:w-[400px] border-l border-gray-200 dark:border-neutral-800" : "md:min-h-[600px]"}`}
        >
          {/* Header */}
          <div className="flex flex-col border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333]">
            <div className="flex items-center justify-between p-4 pb-2 relative">
              <div className="flex items-center gap-3">
                <img
                  src={
                    (post.pages?.avatar_url && post.pages.avatar_url !== "null"
                      ? post.pages.avatar_url
                      : null) ||
                    (post.users?.avatar_url && post.users.avatar_url !== "null"
                      ? post.users.avatar_url
                      : null) ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${post.pages?.id || post.users?.id}`
                  }
                  className="w-10 h-10 rounded-full border object-cover cursor-pointer hover:opacity-80"
                  alt="avatar"
                  onClick={() =>
                    router.push(
                      post.pages
                        ? `/fanpage/${post.pages.id}`
                        : `/profile/${post.user_id}`,
                    )
                  }
                />
                <div className="flex flex-col">
                  <span
                    className="font-semibold text-sm cursor-pointer hover:underline"
                    onClick={() =>
                      router.push(
                        post.pages
                          ? `/fanpage/${post.pages.id}`
                          : `/profile/${post.user_id}`,
                      )
                    }
                  >
                    {post.pages?.name || post.users?.name || "Người dùng"}
                  </span>
                  {post.pages && (
                    <span className="text-xs text-muted-foreground">
                      Đăng bởi{" "}
                      <strong
                        className="cursor-pointer hover:underline text-gray-900 dark:text-gray-100"
                        onClick={() => router.push(`/profile/${post.user_id}`)}
                      >
                        {post.users?.name}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <MoreHorizontal
                  className="w-5 h-5 cursor-pointer text-gray-900 dark:text-gray-100 hover:text-gray-500 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenPostMenu(!openPostMenu);
                  }}
                />
                {openPostMenu && (
                  <div className="absolute right-0 mt-2 w-44 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl dark:shadow-black/50 py-1 z-[100] transition-colors duration-500 bg-white dark:bg-[#333333]">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSavePost();
                      }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                    >
                      <Bookmark
                        size={18}
                        className={post.is_saved ? "fill-current" : ""}
                      />
                      {post.is_saved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setReportTargetId(post.id);
                        setReportType("post");
                        setOpenPostMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                    >
                      <Flag size={18} />
                      Báo cáo
                    </button>

                    {user?.id === post.user_id && (
                      <>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEditingPostId(post.id);
                            setEditPostContent(post.content || "");
                            setOpenPostMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                        >
                          <Pencil size={18} />
                          Sửa bài viết
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleDeletePost();
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-500/10 w-full text-sm font-semibold transition-all"
                        >
                          <Trash2 size={18} />
                          Xóa bài viết
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Caption */}
            {editingPostId === post.id ? (
              <div className="px-4 pb-4 text-sm">
                <textarea
                  className="w-full border border-border bg-secondary/30 rounded-lg p-2 outline-none focus:bg-background transition-colors resize-none"
                  value={editPostContent}
                  onChange={(e) => setEditPostContent(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    onClick={() => setEditingPostId(null)}
                    className="text-xs font-semibold text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from("posts")
                          .update({ content: editPostContent })
                          .eq("id", post.id);
                        if (error) throw error;
                        setPost((prev: any) => ({
                          ...prev,
                          content: editPostContent,
                        }));
                        setEditingPostId(null);
                        toast.success("Đã cập nhật bài viết!");
                      } catch (err) {
                        toast.error("Cập nhật thất bại.");
                      }
                    }}
                    className="text-xs font-semibold text-blue-500 hover:text-blue-600"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            ) : (
              (post.content || post.is_flagged) && (
                <div
                  className={`px-4 pb-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 ${post.is_flagged ? "text-red-500 font-semibold italic" : ""}`}
                >
                  {post.is_flagged
                    ? "Nội dung này đã bị ẩn do vi phạm tiêu chuẩn cộng đồng."
                    : post.content}
                  {post.is_flagged && user?.id === post.user_id && (
                    <button
                      onClick={() => setAppealPostId(post.id)}
                      className="block mt-2 text-blue-500 hover:underline text-[12px] font-bold not-italic"
                    >
                      Gửi yêu cầu xem xét lại (Kháng nghị)
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          {/* Comments List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 relative">
            {(() => {
              const items: any[] = [];
              let tempReplies: any[] = [];
              comments.forEach((c: any) => {
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
                  className={`flex items-start gap-3 group relative cursor-pointer ${isReply ? "ml-10 mt-1" : "mt-4"}`}
                  onDoubleClick={(e) => handleReplyClick(c.users?.name, e)}
                >
                  <img
                    src={
                      (c.users?.avatar_url && c.users.avatar_url !== "null"
                        ? c.users.avatar_url
                        : null) ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`
                    }
                    className={`${isReply ? "w-7 h-7" : "w-10 h-10"} rounded-full border object-cover flex-shrink-0 cursor-pointer`}
                    alt="avatar"
                    onClick={() => router.push(`/profile/${c.user_id}`)}
                  />
                  <div className={`${isReply ? "mt-0" : "mt-1"} flex-1`}>
                    <span
                      className={`font-semibold mr-2 cursor-pointer hover:underline ${isReply ? "text-xs" : "text-sm"}`}
                      onClick={() => router.push(`/profile/${c.user_id}`)}
                    >
                      {c.users?.name || "Người dùng"}
                    </span>
                    {editingCommentId === c.id ? (
                      <div className="flex flex-col gap-1 mt-1">
                        <input
                          className="border border-gray-200 dark:border-neutral-700 px-2 py-1 rounded-lg w-full outline-none text-sm bg-transparent"
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitEditComment(c.id);
                            if (e.key === "Escape") setEditingCommentId(null);
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
                          className={`whitespace-pre-wrap ${isReply ? "text-[13px] text-muted-foreground" : "text-sm"}`}
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
                                setReportTargetId(c.id);
                                setReportType("comment");
                                setOpenCommentMenuId(null);
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

          {/* Action / Input Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <Heart
                onClick={handleLike}
                className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${post.is_liked ? "text-red-500 fill-red-500" : "stroke-[2px] text-gray-900 dark:text-gray-100"}`}
              />
              <span className="font-semibold text-sm">
                {post.likes_count || 0} lượt thích
              </span>
              <button
                onClick={() => setSharePost(post)}
                className="ml-auto flex items-center gap-2 text-sm font-semibold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-full transition-colors"
              >
                <Send className="w-4 h-4" /> Chia sẻ
              </button>
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
                        onClick={() => setCommentText((prev) => prev + emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                ref={inputRef}
                className="flex-1 px-2 py-1.5 text-sm outline-none bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={
                  user ? "Thêm bình luận..." : "Đăng nhập để bình luận"
                }
                disabled={!user}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
              />
              {commentFile && (
                <div className="relative">
                  <img
                    src={URL.createObjectURL(commentFile)}
                    className="h-8 w-8 object-cover rounded border border-gray-200 dark:border-neutral-700"
                  />
                  <button
                    onClick={() => setCommentFile(null)}
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
                  disabled={!user}
                  onChange={(e) => setCommentFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                onClick={handleComment}
                disabled={!commentText.trim() && !commentFile}
                className="text-blue-500 font-semibold text-sm disabled:opacity-50 px-2"
              >
                Đăng
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL CHIA SẺ ================= */}
      {sharePost && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setSharePost(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[340px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Chia sẻ bài viết
              </h3>
              <button
                onClick={() => setSharePost(null)}
                className="hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Đã sao chép liên kết!");
                  setSharePost(null);
                }}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-xl transition-colors text-left"
              >
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-full text-blue-600 dark:text-blue-400 shrink-0">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Sao chép liên kết
                </span>
              </button>
              <button
                onClick={async () => {
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: "InstaMini",
                        text: "Hãy xem bài viết này!",
                        url: window.location.href,
                      });
                      setSharePost(null);
                    } catch (e) {}
                  } else {
                    toast.error("Trình duyệt không hỗ trợ");
                  }
                }}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-xl transition-colors text-left"
              >
                <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-full text-green-600 dark:text-green-400 shrink-0">
                  <Share className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Chia sẻ qua ứng dụng khác...
                </span>
              </button>
            </div>
            {shareFriends.length > 0 && (
              <div className="px-4 pb-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
                  Gửi trực tiếp
                </span>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x [&::-webkit-scrollbar]:hidden">
                  {shareFriends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => handleSendToFriend(friend.id)}
                      className={`flex flex-col items-center gap-1.5 cursor-pointer shrink-0 w-[60px] snap-start transition-opacity ${isSharing ? "opacity-50 pointer-events-none" : "hover:opacity-80"}`}
                    >
                      <img
                        src={
                          friend.avatar_url && friend.avatar_url !== "null"
                            ? friend.avatar_url
                            : `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.id}`
                        }
                        className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-neutral-700 shadow-sm"
                      />
                      <span className="text-[11px] font-semibold text-center truncate w-full text-gray-900 dark:text-gray-100">
                        {friend.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL REPORT & APPEAL ================= */}
      {reportTargetId && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={() => setReportTargetId(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Báo cáo {reportType === "post" ? "bài viết" : "bình luận"}
              </h3>
              <button
                onClick={() => setReportTargetId(null)}
                className="hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Vui lòng nhập lý do báo cáo. Quản trị viên sẽ xem xét báo cáo
                của bạn.
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Ví dụ: Nội dung phản cảm, spam..."
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none resize-none bg-gray-50 dark:bg-[#333333] text-sm text-gray-900 dark:text-gray-100"
                rows={4}
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] rounded-lg"
                onClick={() => setReportTargetId(null)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
                onClick={submitReport}
                disabled={!reportReason.trim()}
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {appealPostId && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={() => setAppealPostId(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Gửi yêu cầu xem xét lại
              </h3>
              <button
                onClick={() => setAppealPostId(null)}
                className="hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Nhập lý do bạn cho rằng bài viết này không vi phạm tiêu chuẩn
                cộng đồng.
              </p>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Ví dụ: Hình ảnh này chỉ là ảnh nghệ thuật..."
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none resize-none bg-gray-50 dark:bg-[#333333] text-sm text-gray-900 dark:text-gray-100"
                rows={4}
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] rounded-lg"
                onClick={() => setAppealPostId(null)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-lg disabled:opacity-50"
                onClick={submitPostAppeal}
                disabled={!appealReason.trim()}
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= XEM ẢNH FULL MÀN HÌNH ================= */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[9999999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setViewingImage(null);
            setImageScale(1);
          }}
        >
          <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
            <div className="flex items-center gap-2 bg-black/50 rounded-full px-2 py-1 shadow-md">
              <button
                className="text-white hover:text-gray-300 p-2 disabled:opacity-50"
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
                className="text-white hover:text-gray-300 p-2 disabled:opacity-50"
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
              className="text-white hover:text-gray-300 p-2 bg-black/50 rounded-full shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                setViewingImage(null);
                setImageScale(1);
              }}
            >
              <X size={24} />
            </button>
          </div>
          <div className="w-full h-full overflow-auto flex items-center justify-center">
            <img
              src={viewingImage}
              className="max-w-full max-h-screen object-contain rounded-xl shadow-2xl transition-transform duration-200"
              style={{ transform: `scale(${imageScale})` }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
