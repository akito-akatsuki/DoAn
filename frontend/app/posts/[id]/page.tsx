"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";
import { Heart, MessageCircle, MoreHorizontal } from "lucide-react";
import Navbar from "@/components/navbar";

export default function PostDetailPage() {
  const { id } = useParams();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [showHeart, setShowHeart] = useState(false);

  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  // ================= LOAD USER =================
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
    const handleClickOutside = () => setOpenCommentMenuId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // ================= LOAD COMMENTS =================
  const loadComments = async () => {
    const { data } = await supabase
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

    setComments(data || []);
  };

  // ================= LOAD POST =================
  const loadPost = async () => {
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

    // check user liked
    let liked = false;
    if (user?.id) {
      const { data: likeData } = await supabase
        .from("likes")
        .select("*")
        .eq("post_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      liked = !!likeData;
    }

    setPost({
      ...data,
      likes_count: likeCount || 0,
      comments_count: commentCount || 0,
    });

    setIsLiked(liked);
    setLoading(false);
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
      if (currentlyLiked) {
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({
          post_id: id,
          user_id: user.id,
        });
      }
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
    if (!user || !comment.trim()) return;

    const text = comment;
    setComment(""); // Clear immediately

    // 🔥 OPTIMISTIC UPDATE
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

    setComments((prev) => [...prev, tempComment]);
    setPost((prev: any) => ({
      ...prev,
      comments_count: (prev.comments_count || 0) + 1,
    }));

    try {
      await supabase
        .from("comments")
        .insert({ post_id: id, user_id: user.id, content: text });
      loadComments(); // Fetch để lấy id thật
    } catch (err) {
      console.error(err);
    }
  };

  // ================= DELETE COMMENT =================
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);

      if (error) throw error;

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPost((prev: any) => ({
        ...prev,
        comments_count: Math.max(0, (prev.comments_count || 0) - 1),
      }));
    } catch (err) {
      console.error(err);
      alert("Xóa bình luận thất bại");
    }
  };

  // ================= EDIT COMMENT =================
  const submitEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      const { data, error } = await supabase
        .from("comments")
        .update({ content: editCommentText })
        .eq("id", commentId)
        .eq("user_id", user.id)
        .select("*, users:user_id(id, name, avatar_url)")
        .single();

      if (error) throw error;

      setComments((prev) => prev.map((c) => (c.id === commentId ? data : c)));
      setEditingCommentId(null);
    } catch (err) {
      console.error(err);
      alert("Sửa bình luận thất bại");
    }
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
    <div className="min-h-screen bg-background">
      {/* NAVBAR */}
      <Navbar user={user} />

      {/* FIX NAVBAR OVERLAP */}
      <div className="max-w-xl mx-auto p-4 pt-20">
        {/* POST */}
        <div className="border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <img
              src={
                post.users?.avatar_url ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user_id}`
              }
              className="w-10 h-10 rounded-full"
            />
            <b>{post.users?.name}</b>
          </div>

          <p className="mb-2">{post.content}</p>

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
                isLiked ? "text-red-500 fill-red-500" : "text-foreground"
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
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Viết bình luận..."
            className="flex-1 border p-2 rounded"
          />
          <button
            onClick={handleComment}
            className="bg-blue-500 text-white px-4 rounded"
          >
            Gửi
          </button>
        </div>

        {/* COMMENTS */}
        <div className="mt-4">
          <h2 className="font-bold mb-4">Bình luận</h2>

          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 mb-4 group items-start">
              <img
                src={
                  c.users?.avatar_url ||
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`
                }
                className="w-10 h-10 rounded-full object-cover border"
              />
              <div className="flex-1">
                <b className="text-sm">{c.users?.name}</b>

                {editingCommentId === c.id ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <input
                      className="border px-3 py-1.5 rounded-lg w-full outline-none text-sm bg-transparent"
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
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">
                    {c.content}
                  </p>
                )}
              </div>

              {user?.id === c.user_id && !editingCommentId && (
                <div className="relative opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <MoreHorizontal
                    className="w-5 h-5 cursor-pointer text-gray-500 hover:text-black"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenCommentMenuId(
                        openCommentMenuId === c.id ? null : c.id,
                      );
                    }}
                  />
                  {openCommentMenuId === c.id && (
                    <div className="absolute right-0 mt-1 w-28 bg-background border border-border shadow-lg rounded-xl py-1 z-50">
                      <button
                        onClick={() => {
                          setEditingCommentId(c.id);
                          setEditCommentText(c.content);
                          setOpenCommentMenuId(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-secondary transition"
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* IMAGE PREVIEW MODAL */}
      {isImageModalOpen && post?.image_url && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          <img
            src={post.image_url}
            className="max-w-full max-h-full object-contain"
            alt="Preview"
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
