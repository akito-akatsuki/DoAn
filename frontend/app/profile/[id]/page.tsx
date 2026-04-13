"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import Link from "next/link";
import { Heart, MoreHorizontal, X } from "lucide-react";
import { useRef } from "react";
import {
  getComments,
  createComment,
  deleteComment,
  updateComment,
  toggleLike,
} from "@/lib/api";

type UserProfile = {
  id: string;
  name: string;
  avatar_url?: string | null;
  bio?: string | null;
};

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ Next 16 fix params
  const { id } = use(params);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // ================= MODAL STATES =================
  const modalInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [modalCommentText, setModalCommentText] = useState("");
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  // ================= CLICK OUTSIDE =================
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenCommentMenuId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ================= LOAD CURRENT USER =================
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data.user);
    };

    loadUser();
  }, []);

  // ================= LOAD PROFILE + POSTS =================
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

      setProfile(user);

      const { data: postsData } = await supabase
        .from("posts")
        .select("id, content, image_url, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

      setPosts(postsData || []);

      setLoading(false);
    };

    load();
  }, [id]);

  // ================= CHECK FOLLOW =================
  useEffect(() => {
    const checkFollow = async () => {
      if (!currentUser || !id) return;

      const { data } = await supabase
        .from("follows")
        .select("*")
        .eq("follower_id", currentUser.id)
        .eq("following_id", id)
        .maybeSingle();

      setIsFollowing(!!data);
    };

    checkFollow();
  }, [currentUser, id]);

  // ================= TOGGLE FOLLOW =================
  const toggleFollow = async () => {
    if (!currentUser || currentUser.id === id) return;

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", id);

      setIsFollowing(false);
    } else {
      await supabase.from("follows").insert({
        follower_id: currentUser.id,
        following_id: id,
      });

      setIsFollowing(true);
    }
  };

  // ================= POST MODAL HANDLERS =================
  const openPostModal = async (post: any) => {
    setSelectedPost({
      ...post,
      users: profile,
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
    if (currentUser) {
      const { data: likeData } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id)
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
  };

  const handleLike = async (postId: string) => {
    if (!currentUser || !selectedPost) return;
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
    if (!currentUser || !modalCommentText.trim() || !selectedPost) return;
    const text = modalCommentText;
    setModalCommentText("");
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      user_id: currentUser.id,
      users: {
        id: currentUser.id,
        name:
          currentUser.user_metadata?.name ||
          currentUser.user_metadata?.full_name ||
          "Bạn",
        avatar_url: currentUser.user_metadata?.avatar_url,
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
    if (!confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;
    try {
      await deleteComment(commentId);
      setModalComments((prev) => prev.filter((c) => c.id !== commentId));
      setOpenCommentMenuId(null);
    } catch (err) {
      console.error(err);
    }
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

  // ================= UI =================
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-20 text-center transition-colors duration-500">
        Đang tải...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-20 text-center transition-colors duration-500">
        Không tìm thấy người dùng
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500">
      {/* 🔥 NAVBAR ADDED */}
      <Navbar user={currentUser} />

      <div className="max-w-[935px] mx-auto pt-24 px-4 pb-10">
        {/* ================= HEADER ================= */}
        <div className="flex items-center gap-8 border-b border-border pb-8">
          <img
            src={
              profile.avatar_url ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.id}`
            }
            className="w-28 h-28 rounded-full"
          />

          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">{profile.name}</h1>

              {currentUser?.id !== id && (
                <button
                  onClick={toggleFollow}
                  className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors ${
                    isFollowing
                      ? "bg-secondary text-foreground hover:bg-secondary/80"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  {isFollowing ? "Đang theo dõi" : "Theo dõi"}
                </button>
              )}
            </div>

            <div className="flex gap-6 mt-4 text-sm">
              <span>
                <b>{posts.length}</b> posts
              </span>
              <span>
                <b>0</b> followers
              </span>
              <span>
                <b>0</b> following
              </span>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {profile.bio || "No bio yet"}
            </p>
          </div>
        </div>

        {/* ================= POSTS GRID ================= */}
        <div className="grid grid-cols-3 gap-1 mt-4">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => openPostModal(post)}
              className="aspect-square bg-secondary/30 border border-border/50 rounded-sm overflow-hidden relative group cursor-pointer"
            >
              {post.image_url ? (
                <img
                  src={post.image_url}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="p-4 flex items-center justify-center w-full h-full text-center text-sm md:text-base break-words">
                  {post.content}
                </div>
              )}

              {/* Hover Dark Layer */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

      {/* ================= MODAL POST ================= */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 md:p-10 cursor-pointer transition-all"
          onClick={closeModal}
        >
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-[10000] p-2"
          >
            <X className="w-8 h-8" />
          </button>

          <div
            className="bg-background text-foreground flex flex-col md:flex-row w-full max-w-5xl max-h-[90vh] rounded-xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 cursor-default transition-colors duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Phần Ảnh */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[500px]">
              {selectedPost.image_url ? (
                <img
                  src={selectedPost.image_url}
                  className="max-w-full max-h-full object-contain"
                  alt="Post"
                />
              ) : (
                <div className="p-8 text-center text-white text-xl font-medium">
                  {selectedPost.content}
                </div>
              )}
            </div>

            {/* Phần Thông tin / Bình luận */}
            <div className="w-full md:w-[400px] flex flex-col border-l border-border bg-background h-[50vh] md:h-auto transition-colors duration-500">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-border">
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

              {/* Content / Caption & Comments */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {/* Caption */}
                <div className="flex items-start gap-3">
                  <img
                    src={
                      selectedPost.users?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedPost.users?.id}`
                    }
                    className="w-10 h-10 rounded-full border object-cover flex-shrink-0"
                    alt="avatar"
                  />
                  <div className="mt-1">
                    <span className="font-semibold text-sm mr-2">
                      {selectedPost.users?.name || "Người dùng"}
                    </span>
                    <span className="text-sm whitespace-pre-wrap">
                      {selectedPost.content}
                    </span>
                  </div>
                </div>

                {/* Comments */}
                {modalComments.map((c: any) => {
                  const isReply = c.content?.trim().startsWith("@");
                  return (
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
                              className="border px-2 py-1 rounded w-full outline-none text-sm bg-transparent"
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

                      {currentUser?.id === c.user_id && !editingCommentId && (
                        <div className="relative opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2 mt-1">
                          <MoreHorizontal
                            className="w-4 h-4 cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCommentMenuId(
                                openCommentMenuId === c.id ? null : c.id,
                              );
                            }}
                          />
                          {openCommentMenuId === c.id && (
                            <div className="absolute right-0 mt-1 w-24 bg-background border border-border shadow-lg rounded-lg py-1 z-50 transition-colors duration-500">
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
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action / Input */}
              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <Heart
                    onClick={() => handleLike(selectedPost.id)}
                    className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${
                      (selectedPost.is_liked ?? false)
                        ? "text-red-500 fill-red-500"
                        : "stroke-[2px] text-foreground"
                    }`}
                  />
                  <span className="font-semibold text-sm">
                    {selectedPost.likes_count || 0} lượt thích
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    ref={modalInputRef}
                    className="border border-border flex-1 px-3 py-2 rounded-full text-sm outline-none bg-secondary/50 focus:bg-background transition-colors"
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
    </div>
  );
}
