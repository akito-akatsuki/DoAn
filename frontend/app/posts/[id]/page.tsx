"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Image as ImageIcon,
  X,
} from "lucide-react";
import Navbar from "@/components/navbar";
import toast from "react-hot-toast";
import { useRef } from "react";
import {
  toggleLike as apiToggleLike,
  createComment as apiCreateComment,
  deleteComment as apiDeleteComment,
  updateComment as apiUpdateComment,
} from "@/lib/api";
import { showConfirm } from "@/components/GlobalConfirm";

export default function PostDetailPage() {
  const { id } = useParams();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});

  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  const commentInputRef = useRef<HTMLInputElement | null>(null);

  // ================= LOAD USER =================
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", data.user.id)
          .single();
        setUser({ ...data.user, ...(dbUser || {}) });
      }
    });
    const handleClickOutside = () => setOpenCommentMenuId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // ================= LOAD COMMENTS =================
  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(
          `
          *,
          users:user_id (
            id,
            name,
            avatar_url
          )
        `,
        )
        .eq("post_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error("Error loading comments:", err);
    }
  };

  // ================= LOAD POST =================
  const loadPost = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          users:user_id (
            id,
            name,
            avatar_url
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // count likes
      const { count: likeCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", id);

      // count comments
      const { count: commentCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", id);

      const currentUser = user || (await supabase.auth.getUser()).data?.user;

      // check user liked
      let liked = false;
      if (currentUser?.id) {
        const { data: likeData } = await supabase
          .from("likes")
          .select("*")
          .eq("post_id", id)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        liked = !!likeData;
      }

      setPost({
        ...data,
        likes_count: likeCount || 0,
        comments_count: commentCount || 0,
      });

      setIsLiked(liked);
    } catch (err) {
      console.error("Error loading post:", err);
    } finally {
      setLoading(false);
    }
  };

  // ================= DOUBLE CLICK LIKE =================
  const handleDoubleClick = async (e: any) => {
    e.stopPropagation();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 1000);

    if (!isLiked && user) {
      await toggleLike();
    }
  };

  // ================= LIKE =================
  const toggleLike = async (e?: any) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!user) return;

    // 🔥 OPTIMISTIC UPDATE
    const currentlyLiked = isLiked;
    setIsLiked(!currentlyLiked);
    setPost((prev: any) => ({
      ...prev,
      likes_count: !currentlyLiked
        ? (prev.likes_count || 0) + 1
        : Math.max(0, (prev.likes_count || 0) - 1),
    }));

    try {
      const res = await apiToggleLike(id as string);
      setIsLiked(res.is_liked);
      setPost((prev: any) => ({
        ...prev,
        likes_count:
          (res as any).likes !== undefined
            ? (res as any).likes
            : res.likes_count,
      }));
    } catch (err) {
      // Lỗi thì roll-back (trả lại trạng thái cũ)
      setIsLiked(currentlyLiked);
      setPost((prev: any) => ({
        ...prev,
        likes_count: currentlyLiked
          ? (prev.likes_count || 0) + 1
          : Math.max(0, (prev.likes_count || 0) - 1),
      }));
    }
  };

  // ================= COMMENT =================
  const handleComment = async () => {
    if (!user || (!comment.trim() && !commentFile)) return;

    const text = comment;
    setComment(""); // Clear immediately
    const currentFile = commentFile;
    setCommentFile(null);

    // 🔥 OPTIMISTIC UPDATE
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      image_url: currentFile ? URL.createObjectURL(currentFile) : null,
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

    setComments((prev) => [...prev, tempComment]);
    setPost((prev: any) => ({
      ...prev,
      comments_count: (prev.comments_count || 0) + 1,
    }));

    try {
      let imageUrl = null;
      if (currentFile) {
        const cleanName = currentFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `comment_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("comment_images")
          .upload(fileName, currentFile);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("comment_images")
            .getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        }
      }
      const newCmt = await apiCreateComment(id as string, text, imageUrl);
      setComments((prev) => prev.map((c) => (c.id === tempId ? newCmt : c)));
    } catch (err) {
      console.error(err);
      alert("Không thể lưu bình luận!");
    }
  };

  // ================= DELETE COMMENT =================
  const handleDeleteComment = async (commentId: string) => {
    showConfirm("Bạn có chắc chắn muốn xóa bình luận này?", async () => {
      try {
        await apiDeleteComment(commentId);

        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setPost((prev: any) => ({
          ...prev,
          comments_count: Math.max(0, (prev.comments_count || 0) - 1),
        }));
      } catch (err) {
        console.error(err);
        toast.error("Xóa bình luận thất bại");
      }
    });
  };

  // ================= EDIT COMMENT =================
  const submitEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      const updated = await apiUpdateComment(commentId, editCommentText);

      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c)),
      );
      setEditingCommentId(null);
    } catch (err) {
      console.error(err);
      toast.error("Sửa bình luận thất bại");
    }
  };

  // ================= REPLY COMMENT =================
  const handleReplyClick = (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!username) return;

    const newText = comment.startsWith(`@${username} `)
      ? comment
      : `@${username} ${comment}`;

    setComment(newText);
    setTimeout(() => commentInputRef.current?.focus(), 50);
  };

  // ================= INIT =================
  useEffect(() => {
    if (id) {
      loadPost();
      loadComments();
    }
  }, [id, user]);

  if (loading) return <p className="p-4">Loading...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 transition-colors duration-500">
      {/* NAVBAR */}

      {/* FIX NAVBAR OVERLAP */}
      <div className="max-w-xl mx-auto p-4 pt-20 pb-24 md:pb-10">
        {/* POST */}
        <div className="border border-gray-200 dark:border-neutral-800 shadow-md hover:shadow-lg dark:shadow-black/40 rounded-xl p-4 bg-white dark:bg-[#262626] transition-all">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={
                post.users?.avatar_url ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user_id}`
              }
              className="w-10 h-10 rounded-full"
            />
            <div>
              <b className="block text-sm">{post.users?.name}</b>
              <span className="text-xs text-muted-foreground block">
                {new Date(
                  post.created_at.includes("Z") || post.created_at.includes("+")
                    ? post.created_at
                    : `${post.created_at}Z`,
                ).toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </div>

          {post.content && (
            <p className="mb-3 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {post.content}
            </p>
          )}

          {post.image_url && (
            <div
              className="relative overflow-hidden rounded-xl cursor-pointer select-none"
              onDoubleClick={handleDoubleClick}
            >
              <img
                src={post.image_url}
                className="w-full hover:opacity-90 transition-opacity"
                onClick={() => setIsImageModalOpen(true)}
                alt="Post image"
              />
              {showHeart && (
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <Heart className="w-24 h-24 text-white fill-white drop-shadow-[0_0_15px_rgba(0,0,0,0.4)] animate-heart-pop opacity-90" />
                </div>
              )}
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex gap-4 mt-3 items-center">
            <Heart
              onClick={toggleLike}
              className={`cursor-pointer transition ${
                isLiked
                  ? "text-red-500 fill-red-500"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            />

            <span className="text-sm font-semibold">
              {post.likes_count || 0} lượt thích
            </span>

            <MessageCircle />

            <span className="text-sm font-semibold">
              {post.comments_count || 0} bình luận
            </span>
          </div>
        </div>

        {/* COMMENT INPUT */}
        <div className="mt-4 flex gap-2">
          <input
            ref={commentInputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Viết bình luận..."
            className="flex-1 border border-gray-200 dark:border-neutral-700 shadow-inner p-2 rounded-xl outline-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-colors"
          />
          {commentFile && (
            <div className="relative">
              <img
                src={URL.createObjectURL(commentFile)}
                className="h-10 w-10 object-cover rounded border border-gray-200 dark:border-neutral-700"
              />
              <button
                onClick={() => setCommentFile(null)}
                className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5 shadow-sm"
              >
                <X size={10} />
              </button>
            </div>
          )}
          <label className="cursor-pointer text-gray-500 hover:text-blue-500 p-2 flex items-center justify-center bg-gray-100 dark:bg-[#333333] rounded-xl hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors">
            <ImageIcon size={20} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setCommentFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            onClick={handleComment}
            disabled={!comment.trim() && !commentFile}
            className="bg-blue-500 text-white px-4 rounded disabled:opacity-50"
          >
            Gửi
          </button>
        </div>

        {/* COMMENTS */}
        <div className="mt-4">
          <h2 className="font-bold mb-4">Bình luận</h2>

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
                className={`flex gap-3 group items-start cursor-pointer ${
                  isReply ? "ml-10 mb-2" : "mb-5"
                }`}
                onDoubleClick={(e) => handleReplyClick(c.users?.name, e)}
              >
                <img
                  src={
                    c.users?.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`
                  }
                  className={`${
                    isReply ? "w-7 h-7" : "w-10 h-10"
                  } rounded-full object-cover border`}
                />
                <div className="flex-1">
                  <b className={`${isReply ? "text-xs" : "text-sm"}`}>
                    {c.users?.name}
                  </b>

                  {editingCommentId === c.id ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <input
                        className="border border-gray-200 dark:border-neutral-700 shadow-inner px-3 py-1.5 rounded-lg w-full outline-none text-sm bg-transparent"
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitEditComment(c.id);
                          if (e.key === "Escape") setEditingCommentId(null);
                        }}
                        autoFocus
                      />
                      <div className="flex gap-3 text-xs">
                        <button
                          onClick={() => submitEditComment(c.id)}
                          className="text-blue-500 font-semibold hover:underline"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={() => setEditingCommentId(null)}
                          className="text-gray-500 hover:underline"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col mt-0.5">
                      <p
                        className={`whitespace-pre-wrap ${
                          isReply
                            ? "text-[13px] text-muted-foreground"
                            : "text-sm"
                        }`}
                      >
                        {c.content}
                      </p>
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

                {user?.id === c.user_id && !editingCommentId && (
                  <div className="relative opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <MoreHorizontal
                      className="w-5 h-5 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCommentMenuId(
                          openCommentMenuId === c.id ? null : c.id,
                        );
                      }}
                    />
                    {openCommentMenuId === c.id && (
                      <div className="absolute right-0 mt-1 w-28 bg-white dark:bg-[#333333] border border-gray-200 dark:border-neutral-700 shadow-lg dark:shadow-black/50 rounded-xl py-1 z-50 transition-colors duration-500">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingCommentId(c.id);
                            setEditCommentText(c.content);
                            setOpenCommentMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition"
                        >
                          Sửa
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteComment(c.id);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-secondary transition"
                        >
                          Xóa
                        </button>
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
                          className="ml-10 mb-2 flex items-center gap-3 cursor-pointer group"
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
      </div>

      {/* IMAGE PREVIEW MODAL */}
      {isImageModalOpen && post?.image_url && (
        <div
          className="fixed inset-0 z-[9999] bg-[#262626]/95 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          <img
            src={post.image_url}
            className="max-w-full max-h-full object-contain"
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* STYLE FOR ANIMATION */}
      <style jsx global>{`
        @keyframes heart-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          15% {
            transform: scale(1.2);
            opacity: 1;
          }
          30% {
            transform: scale(1);
            opacity: 1;
          }
          80% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .animate-heart-pop {
          animation: heart-pop 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
