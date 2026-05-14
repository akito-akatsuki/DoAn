"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import toast from "react-hot-toast";
import {
  Bookmark,
  Heart,
  MoreHorizontal,
  X,
  Smile,
  Flag,
  Maximize,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  getComments,
  createComment,
  deleteComment,
  updateComment,
  toggleLike,
  reportPost,
  reportComment,
} from "@/lib/api";
import { showConfirm } from "@/components/GlobalConfirm";

export default function SavedPage() {
  const [user, setUser] = useState<any>(null);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ================= MODAL STATES =================
  const modalInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [modalCommentText, setModalCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [openPostMenu, setOpenPostMenu] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});

  // ================= REPORT =================
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"post" | "comment">("post");
  const [reportReason, setReportReason] = useState("");

  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);

  // ================= CLICK OUTSIDE =================
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Lấy danh sách bài viết đã lưu, join với bảng posts và users
        const { data, error } = await supabase
          .from("saved_posts")
          .select(
            `
            id,
            post_id,
            posts (
              id,
              content,
              image_url,
              is_flagged,
              user_id,
              users (
                id,
                name,
                avatar_url
              )
            )
          `,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (data) {
          const filteredData = data.filter(
            (item: any) =>
              item.posts &&
              (!item.posts.is_flagged || item.posts.user_id === user.id),
          );
          setSavedPosts(filteredData);
        }
        if (error) {
          console.error("Error fetching saved posts:", error);
        }
      }
      setLoading(false);
    };

    loadData();
  }, []);

  // ================= POST MODAL HANDLERS =================
  const openPostModal = async (post: any) => {
    setSelectedPost({
      ...post,
      likes_count: 0,
      is_liked: false,
    });

    const { data: fullPost } = await supabase
      .from("posts")
      .select("*, users:user_id (id, name, avatar_url)")
      .eq("id", post.id)
      .single();

    const { count: likeCount } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);

    let isLiked = false;
    if (user) {
      const { data: likeData } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", user.id)
        .maybeSingle();
      isLiked = !!likeData;
    }

    setSelectedPost({
      ...fullPost,
      likes_count: likeCount || 0,
      is_liked: isLiked,
    });

    const data = await getComments(post.id);
    setModalComments(data || []);
  };

  const closeModal = () => {
    setSelectedPost(null);
    setModalComments([]);
    setModalCommentText("");
    setOpenCommentMenuId(null);
    setShowEmojiPicker(false);
    setEditingCommentId(null);
    setOpenPostMenu(false);
    setExpandedReplies({});
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
    if (!user || !modalCommentText.trim() || !selectedPost) return;
    const text = modalCommentText;
    setModalCommentText("");
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      user_id: user.id,
      users: {
        id: user.id,
        name:
          user.user_metadata?.name || user.user_metadata?.full_name || "Bạn",
        avatar_url: user.user_metadata?.avatar_url,
      },
    };
    setModalComments((prev) => [...prev, tempComment]);
    try {
      const newCmt = await createComment(selectedPost.id, text);
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
    }
  };

  const handleUnsavePost = async (postId: string) => {
    showConfirm("Bạn có chắc chắn muốn bỏ lưu bài viết này?", async () => {
      if (!user) return;
      try {
        const { error } = await supabase
          .from("saved_posts")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;

        setSavedPosts((prev) => prev.filter((item) => item.post_id !== postId));
        closeModal();
        toast.success("Đã bỏ lưu bài viết");
      } catch (err) {
        console.error(err);
        toast.error("Bỏ lưu thất bại");
      }
    });
  };

  const handleReportPost = (postId: string) => {
    setReportTargetId(postId);
    setReportType("post");
    setReportReason("");
    setOpenPostMenu(false);
  };

  const handleReportComment = (commentId: string) => {
    if (!user) return;
    setReportTargetId(commentId);
    setReportType("comment");
    setReportReason("");
    setOpenCommentMenuId(null);
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
      console.error("REPORT POST ERROR:", err);
      toast.error("Đã xảy ra lỗi khi báo cáo bài viết.");
    }
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[935px] mx-auto pt-24 px-4 pb-28 md:pb-20">
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-neutral-800 pb-4 mb-6">
          <Bookmark className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Đã lưu</h1>
        </div>

        {loading && <div className="text-center py-10">Đang tải...</div>}

        {!loading && savedPosts.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            Bạn chưa lưu bài viết nào.
          </div>
        )}

        <div className="grid grid-cols-3 gap-1 md:gap-4">
          {savedPosts.map((item) => {
            const post = item.posts;
            if (!post) return null;

            return (
              <div
                key={item.id}
                onClick={() => openPostModal(post)}
                className="aspect-square overflow-hidden relative group cursor-pointer border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md dark:shadow-black/40 rounded-sm transition-all bg-white dark:bg-[#262626]"
              >
                {/* IMAGE / CONTENT */}
                {post.image_url ? (
                  <img
                    src={post.image_url}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    alt="Saved post"
                  />
                ) : (
                  <div className="p-4 flex items-center justify-center w-full h-full text-center text-sm md:text-base break-words">
                    {post.content}
                  </div>
                )}

                {/* ================= NEW: USER INFO OVERLAY ================= */}
                <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded-full text-xs opacity-0 group-hover:opacity-100 transition bg-white/90 dark:bg-[#262626]/90 text-gray-900 dark:text-gray-100 shadow-md">
                  <img
                    src={
                      post.users?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${post.users?.id}`
                    }
                    className="w-5 h-5 rounded-full"
                  />
                  <span className="font-medium">
                    {post.users?.name || "Unknown"}
                  </span>
                </div>

                {/* hover dark layer */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
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
              <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center min-h-[300px] md:min-h-[500px] relative group">
                <img
                  src={selectedPost.image_url}
                  className="w-full h-full object-cover object-center"
                  alt="Post"
                />
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
              </div>
            )}

            {/* Phần Thông tin / Bình luận */}
            <div
              className={`w-full flex flex-col h-[50vh] md:h-auto transition-colors duration-500 bg-white dark:bg-[#262626] ${selectedPost.image_url ? "md:w-[400px] border-l border-gray-200 dark:border-neutral-800" : "md:min-h-[500px]"}`}
            >
              {/* Header & Content */}
              <div className="flex flex-col border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 pb-2 relative">
                  <div className="flex items-center gap-3">
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
                            e.stopPropagation();
                            handleUnsavePost(selectedPost.id);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all text-red-500"
                        >
                          <Bookmark className="w-4 h-4" />
                          Bỏ lưu bài viết
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Caption */}
                {selectedPost.content && (
                  <div className="px-4 pb-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {selectedPost.content}
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
                          <span
                            className={`whitespace-pre-wrap ${
                              isReply
                                ? "text-[13px] text-muted-foreground"
                                : "text-sm"
                            }`}
                          >
                            {c.content}
                          </span>
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
                  <button
                    onClick={handleModalComment}
                    disabled={!modalCommentText.trim()}
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
                Báo cáo {reportType === "post" ? "bài viết" : "bình luận"}
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
                Vui lòng nhập lý do báo cáo{" "}
                {reportType === "post" ? "bài viết" : "bình luận"} này. Quản trị
                viên sẽ xem xét báo cáo của bạn.
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
    </div>
  );
}
