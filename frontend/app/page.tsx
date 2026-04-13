"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import ChatBox from "@/components/ChatBox";
import { useRouter } from "next/navigation";

import {
  Heart,
  MessageCircle,
  Send,
  Trash2,
  MoreHorizontal,
  MessageSquare, // Thêm cái này
  X, // Thêm cái này
  Bookmark, // Icon lưu
  Flag, // Icon báo cáo
} from "lucide-react";
import {
  getFeed,
  createPost,
  toggleLike,
  getComments,
  createComment,
  savePost,
  reportPost,
  deleteComment,
  updateComment,
} from "@/lib/api";

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);

  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});

  // Dropdown state & Ref
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // State cho hiệu ứng tim bay khi double click
  const [showHeartId, setShowHeartId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // ================= MODAL POST =================
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [modalCommentText, setModalCommentText] = useState("");

  // ================= COMMENT MENUS & EDIT =================
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  // ================= INIT =================
  useEffect(() => {
    // Kích hoạt scroll mượt toàn trang
    document.documentElement.style.scrollBehavior = "smooth";

    loadUser();
    loadFeed();

    const channel = supabase
      .channel("posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => loadFeed(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Xử lý Click Outside để ẩn menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        openMenuId &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpenMenuId(null);
      }
      setOpenCommentMenuId(null); // Đóng menu bình luận khi bấm ra ngoài
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const loadUser = async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      const data = await getFeed();
      setPosts(data || []);
    } finally {
      setLoading(false);
    }
  };

  // ================= LIKE + ANIMATION =================
  const handleLike = async (postId: string, isDoubleClick = false) => {
    if (!user) return;

    // Nếu double click, hiện trái tim giữa màn hình bài viết
    if (isDoubleClick) {
      setShowHeartId(postId);
      setTimeout(() => setShowHeartId(null), 1000);
    }

    // 🔥 OPTIMISTIC UPDATE: Cập nhật UI ngay lập tức
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.is_liked;
          return {
            ...p,
            is_liked: isLiked,
            likes_count: isLiked
              ? (p.likes_count || 0) + 1
              : Math.max(0, (p.likes_count || 0) - 1),
          };
        }
        return p;
      }),
    );

    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost((prev: any) => {
        const isLiked = !prev.is_liked;
        return {
          ...prev,
          is_liked: isLiked,
          likes_count: isLiked
            ? (prev.likes_count || 0) + 1
            : Math.max(0, (prev.likes_count || 0) - 1),
        };
      });
    }

    // Gọi API ngầm phía sau để đồng bộ dữ liệu thật
    try {
      const res = await toggleLike(postId);
      // Tùy chọn: Đồng bộ lại chính xác số đếm từ server
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: res.is_liked, likes_count: res.likes_count }
            : p,
        ),
      );
    } catch (error) {
      console.error("Lỗi khi like:", error);
    }
  };

  // ================= COMMENTS =================
  const loadComments = async (postId: string) => {
    const data = await getComments(postId);
    setCommentsMap((prev) => ({ ...prev, [postId]: data || [] }));
  };

  const handleComment = async (postId: string) => {
    const text = commentInput[postId];
    if (!text) return;

    // Xóa input ngay lập tức
    setCommentInput((prev) => ({ ...prev, [postId]: "" }));

    // 🔥 OPTIMISTIC UPDATE
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      user_id: user?.id,
      users: {
        id: user?.id,
        name:
          user?.user_metadata?.name || user?.user_metadata?.full_name || "Bạn",
        avatar_url: user?.user_metadata?.avatar_url,
      },
    };

    setCommentsMap((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), tempComment],
    }));

    // Gọi API ngầm
    try {
      const newComment = await createComment(postId, text);
      // Đổi comment ảo thành comment thật (để có ID thật dùng cho việc xóa/sửa)
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) =>
          c.id === tempId ? newComment : c,
        ),
      }));
    } catch (err) {
      console.error("Lỗi khi bình luận", err);
    }
  };

  // ================= OPEN MODAL =================
  const openPostModal = async (post: any) => {
    setSelectedPost(post);
    const data = await getComments(post.id);
    setModalComments(data || []);
  };

  const closeModal = () => {
    setSelectedPost(null);
    setModalComments([]);
    setModalCommentText("");
  };

  const handleModalComment = async () => {
    if (!user || !modalCommentText.trim() || !selectedPost) return;

    const text = modalCommentText;
    setModalCommentText(""); // Xóa input ngay lập tức

    // 🔥 OPTIMISTIC UPDATE
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      user_id: user?.id,
      users: {
        id: user?.id,
        name:
          user?.user_metadata?.name || user?.user_metadata?.full_name || "Bạn",
        avatar_url: user?.user_metadata?.avatar_url,
      },
    };

    setModalComments((prev) => [...prev, tempComment]);
    setCommentsMap((prev) => ({
      ...prev,
      [selectedPost.id]: [...(prev[selectedPost.id] || []), tempComment],
    }));

    try {
      const newCmt = await createComment(selectedPost.id, text);
      setModalComments((prev) =>
        prev.map((c) => (c.id === tempId ? newCmt : c)),
      );
      setCommentsMap((prev) => ({
        ...prev,
        [selectedPost.id]: (prev[selectedPost.id] || []).map((c) =>
          c.id === tempId ? newCmt : c,
        ),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // ================= DELETE COMMENT =================
  const handleDeleteComment = async (
    commentId: string,
    postId: string,
    isModal = false,
  ) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;
    try {
      await deleteComment(commentId);
      if (isModal) {
        setModalComments((prev) => prev.filter((c) => c.id !== commentId));
      }
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: prev[postId]?.filter((c) => c.id !== commentId) || [],
      }));
      setOpenCommentMenuId(null);
    } catch (err) {
      console.error(err);
      alert("Xóa bình luận thất bại.");
    }
  };

  // ================= EDIT COMMENT =================
  const submitEditComment = async (
    commentId: string,
    postId: string,
    isModal = false,
  ) => {
    if (!editCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editCommentText);
      if (isModal) {
        setModalComments((prev) =>
          prev.map((c) => (c.id === commentId ? updated : c)),
        );
      }
      setCommentsMap((prev) => ({
        ...prev,
        [postId]:
          prev[postId]?.map((c) => (c.id === commentId ? updated : c)) || [],
      }));
      setEditingCommentId(null);
      setOpenCommentMenuId(null);
    } catch (err) {
      console.error(err);
      alert("Sửa bình luận thất bại.");
    }
  };

  // ================= DELETE POST =================
  const handleDeletePost = async (postId: string) => {
    if (!confirm("Xóa bài viết này?")) return;

    try {
      // 🔥 lấy token từ Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`http://localhost:5000/posts/${postId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Delete failed");
      }

      // 🔥 update UI ngay
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setOpenMenuId(null);
    } catch (err) {
      console.error("DELETE ERROR:", err);
    }
  };

  // ================= SAVE POST =================
  const handleSavePost = async (postId: string) => {
    try {
      await savePost(postId);
      alert("Đã lưu bài viết thành công!");
      setOpenMenuId(null);
    } catch (err) {
      console.error("SAVE POST ERROR:", err);
      alert("Đã xảy ra lỗi khi lưu bài viết.");
    }
  };

  // ================= REPORT POST =================
  const handleReportPost = async (postId: string) => {
    const reason = prompt("Vui lòng nhập lý do báo cáo bài viết này:");
    if (!reason) return;
    try {
      await reportPost(postId, reason);
      alert("Đã gửi báo cáo thành công!");
      setOpenMenuId(null);
    } catch (err) {
      console.error("REPORT POST ERROR:", err);
      alert("Đã xảy ra lỗi khi báo cáo bài viết.");
    }
  };

  return (
    <div className="min-h-screen select-none">
      {" "}
      {/* select-none ở root để mượt hơn khi double click */}
      <Navbar user={user} />
      <main className="pt-16 max-w-[470px] mx-auto px-2 mb-10">
        {/* CREATE POST */}
        <div className="bg-background shadow-ig rounded-[12px] p-4 mb-2 border ring-1 ring-border">
          <div className="flex items-start gap-4">
            <img
              src={
                user?.user_metadata?.avatar_url ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.id}`
              }
              className="w-10 h-10 rounded-full ring-1 ring-border flex-shrink-0 mt-1"
              alt="Your avatar"
            />
            <div className="flex-1 min-w-0">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Bạn đang nghĩ gì?"
                className="w-full text-base resize-none outline-none min-h-[80px] placeholder:text-muted bg-transparent pt-1 select-text" // Cho phép chọn text ở đây
                rows={2}
              />
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1 text-primary text-sm cursor-pointer hover:underline">
                  📷 Ảnh
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept="image/*"
                  />
                </label>
                <button
                  onClick={async () => {
                    if (!content && !file) return;

                    try {
                      let imageUrl = null;

                      // ================= UPLOAD IMAGE =================
                      if (file) {
                        const cleanName = file.name.replace(
                          /[^a-zA-Z0-9.]/g,
                          "_",
                        );
                        const fileName = `${Date.now()}_${cleanName}`;

                        const { error: uploadError } = await supabase.storage
                          .from("posts")
                          .upload(fileName, file);

                        if (uploadError) {
                          console.error("UPLOAD ERROR:", uploadError.message);
                          return;
                        }

                        const { data } = supabase.storage
                          .from("posts")
                          .getPublicUrl(fileName);

                        imageUrl = data.publicUrl;
                      }

                      // ================= CREATE POST =================
                      const newPost = await createPost({
                        content,
                        image_url: imageUrl,
                      });

                      if (!newPost) {
                        console.error("CREATE POST FAILED");
                        return;
                      }

                      // ================= UPDATE UI =================
                      setPosts((prev) => [newPost, ...prev]);

                      // ================= RESET =================
                      setContent("");
                      setFile(null);
                    } catch (err) {
                      console.error("POST ERROR:", err);
                    }
                  }}
                  disabled={!content && !file}
                  className="bg-gradient-to-r from-primary to-accent text-primary-fg px-5 py-1.5 rounded-full font-semibold text-sm shadow-ig hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Đăng
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FEED */}
        <div className="space-y-4">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted"></div>
            </div>
          )}

          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-background shadow-ig rounded-lg overflow-hidden border ring-1 ring-border mb-2 relative"
              onDoubleClick={() => handleLike(post.id, true)}
            >
              {/* BIG HEART POP ANIMATION */}
              {showHeartId === String(post.id) && (
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <Heart className="w-24 h-24 text-white fill-white drop-shadow-[0_0_15px_rgba(0,0,0,0.4)] animate-heart-pop opacity-90" />
                </div>
              )}

              {/* HEADER */}
              <div className="flex items-center justify-between p-4 relative">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      post?.users?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user_id}`
                    }
                    className="w-10 h-10 rounded-full ring-1 ring-border cursor-pointer hover:brightness-105"
                  />
                  <div>
                    <span className="font-semibold text-sm block leading-tight">
                      {post?.users?.name || "unknown"}
                    </span>
                    <span className="text-xs text-muted leading-tight">
                      {new Date(post.created_at).toLocaleDateString("vi-VN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>

                {/* 3 DOT MENU */}
                <div
                  className="relative"
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal
                    className="w-5 h-5 cursor-pointer p-1 hover:bg-secondary rounded-full transition-all"
                    onClick={(e) => {
                      e.stopPropagation(); // Ngăn sự kiện click outside ngay lập tức
                      setOpenMenuId(
                        openMenuId === String(post.id) ? null : String(post.id),
                      );
                    }}
                  />

                  {openMenuId === String(post.id) && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 mt-2 w-44 bg-background border ring-1 ring-border rounded-xl shadow-xl py-1 z-[100]"
                    >
                      <button
                        onClick={() => handleSavePost(post.id)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                      >
                        <Bookmark size={18} />
                        Lưu bài viết
                      </button>

                      <button
                        onClick={() => handleReportPost(post.id)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                      >
                        <Flag size={18} />
                        Báo cáo
                      </button>

                      {/* Chỉ hiện nút Xóa nếu là bài viết của chính người dùng */}
                      {user?.id === post.user_id && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-500/10 w-full text-sm font-semibold transition-all"
                        >
                          <Trash2 size={18} />
                          Xóa bài viết
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* IMAGE WITH DOUBLE CLICK LIKE */}
              {post.image_url && (
                <div className="relative overflow-hidden bg-secondary/20">
                  <img
                    src={post.image_url}
                    className="w-full aspect-square object-cover cursor-pointer hover:brightness-[0.98] transition-all duration-300 select-none pointer-events-none"
                    alt="Post content"
                  />

                  {/* Overlay ẩn để catch event tốt hơn */}
                  <div
                    className="absolute inset-0 z-10 cursor-pointer"
                    onClick={() => openPostModal(post)}
                  />
                </div>
              )}

              {/* ACTIONS */}
              <div className="p-3">
                <div className="flex gap-3 pt-2 pb-1">
                  <Heart
                    onClick={() => handleLike(post.id)}
                    className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${
                      (post.is_liked ?? false)
                        ? "text-red-500 fill-red-500" // Đổi từ destructive sang red-500 cho chắc chắn
                        : "stroke-[2px] text-foreground"
                    }`}
                  />
                  <MessageCircle
                    onClick={() => openPostModal(post)}
                    className="w-7 h-7 cursor-pointer stroke-[2px]"
                  />
                  <Send className="w-7 h-7 cursor-pointer stroke-[2px]" />
                </div>

                <p className="text-sm font-bold mt-1">
                  {post.likes_count || 0} lượt thích
                </p>

                <div className="text-sm mt-1 mb-2 select-text">
                  {" "}
                  {/* select-text để caption vẫn copy được */}
                  <span className="font-semibold mr-2">
                    {post?.users?.name || "user"}
                  </span>
                  {post.content}
                </div>

                {/* COMMENTS SECTION */}
                <div className="mt-2 space-y-1 select-text">
                  {commentsMap[post.id]?.map((c: any, idx: number) => (
                    <div
                      key={c.id ?? idx}
                      className="text-sm flex justify-between items-start group"
                    >
                      <div className="flex-1">
                        <span className="font-bold mr-1">
                          {c?.users?.name || "user"}:
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
                                if (e.key === "Enter")
                                  submitEditComment(c.id, post.id);
                                if (e.key === "Escape")
                                  setEditingCommentId(null);
                              }}
                              autoFocus
                            />
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => submitEditComment(c.id, post.id)}
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
                          <span>{c.content}</span>
                        )}
                      </div>

                      {user?.id === c.user_id && !editingCommentId && (
                        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity ml-2">
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
                            <div className="absolute right-0 mt-1 w-24 bg-background border border-border shadow-lg rounded-lg py-1 z-50">
                              <button
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setEditCommentText(c.content);
                                  setOpenCommentMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1 text-sm hover:bg-secondary"
                              >
                                Sửa
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteComment(c.id, post.id)
                                }
                                className="w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-secondary"
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

                {/* ADD COMMENT */}
                <div className="flex items-center gap-3 pt-3 mt-2 border-t border-border">
                  <img
                    src={
                      user?.user_metadata?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.id}`
                    }
                    className="w-7 h-7 rounded-full flex-shrink-0"
                    alt="User"
                  />
                  <input
                    value={commentInput[post.id] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;

                      setCommentInput((prev) => ({
                        ...prev,
                        [post.id]: value,
                      }));
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="flex-1 text-sm outline-none bg-transparent select-text"
                    placeholder="Thêm bình luận..."
                  />
                  {commentInput[post.id] && (
                    <button
                      onClick={() => handleComment(post.id)}
                      className="text-primary font-semibold text-sm"
                    >
                      Đăng
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      {/* ================= MODAL POST ================= */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 md:p-10 cursor-pointer"
          onClick={closeModal}
        >
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-[10000] p-2"
          >
            <X className="w-8 h-8" />
          </button>

          <div
            className="bg-background text-foreground flex flex-col md:flex-row w-full max-w-5xl max-h-[90vh] rounded-xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 cursor-default"
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
            <div className="w-full md:w-[400px] flex flex-col border-l border-border bg-background h-[50vh] md:h-auto">
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
                {modalComments.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 group relative"
                  >
                    <img
                      src={
                        c.users?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`
                      }
                      className="w-10 h-10 rounded-full border object-cover flex-shrink-0"
                      alt="avatar"
                    />
                    <div className="mt-1 flex-1">
                      <span className="font-semibold text-sm mr-2">
                        {c.users?.name || "Người dùng"}
                      </span>
                      {editingCommentId === c.id ? (
                        <div className="flex flex-col gap-1 mt-1">
                          <input
                            className="border px-2 py-1 rounded w-full outline-none text-sm bg-transparent"
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                submitEditComment(c.id, selectedPost.id, true);
                              if (e.key === "Escape") setEditingCommentId(null);
                            }}
                            autoFocus
                          />
                          <div className="flex gap-2 text-xs">
                            <button
                              onClick={() =>
                                submitEditComment(c.id, selectedPost.id, true)
                              }
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
                        <span className="text-sm whitespace-pre-wrap">
                          {c.content}
                        </span>
                      )}
                    </div>

                    {user?.id === c.user_id && !editingCommentId && (
                      <div className="relative opacity-0 group-hover:opacity-100 transition-opacity ml-2 mt-1">
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
                          <div className="absolute right-0 mt-1 w-24 bg-background border border-border shadow-lg rounded-lg py-1 z-50">
                            <button
                              onClick={() => {
                                setEditingCommentId(c.id);
                                setEditCommentText(c.content);
                                setOpenCommentMenuId(null);
                              }}
                              className="w-full text-left px-3 py-1 text-sm hover:bg-secondary"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteComment(c.id, selectedPost.id, true)
                              }
                              className="w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-secondary"
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
      {/* FIXED CHAT UI */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-4">
        {/* Khung ChatBox hiện lên khi nhấn nút */}
        {isChatOpen && user && (
          <div className="w-[380px] h-[550px] bg-background text-foreground rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header thanh Chat */}
            <div className="p-3 border-b border-border flex justify-between items-center bg-secondary/50">
              <span className="font-bold text-sm">Tin nhắn mới</span>
              <button
                onClick={() => setIsChatOpen(false)}
                className="hover:bg-secondary rounded-full p-1 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Component ChatBox đã có ô Search bên trong */}
            <ChatBox userId={user.id} />
          </div>
        )}

        {/* Nút tròn để Toggle Chat */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`shadow-2xl transition-all active:scale-90 p-4 rounded-full flex items-center justify-center ${
            isChatOpen
              ? "bg-background text-foreground border border-border"
              : "bg-[#0095F6] text-white hover:bg-blue-600"
          }`}
        >
          {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>
      </div>
      {/* Tailwind Extra Styles for Animations */}
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
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
