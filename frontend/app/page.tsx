"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import ChatBox from "@/components/ChatBox";

import {
  Heart,
  MessageCircle,
  Send,
  Trash2,
  MoreHorizontal,
  MessageSquare, // Thêm cái này
  X, // Thêm cái này
} from "lucide-react";
import {
  getFeed,
  createPost,
  toggleLike,
  getComments,
  createComment,
} from "@/lib/api";

export default function HomePage() {
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

    const res = await toggleLike(postId);

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...res } : p)),
    );
  };

  // ================= COMMENTS =================
  const loadComments = async (postId: string) => {
    const data = await getComments(postId);
    setCommentsMap((prev) => ({ ...prev, [postId]: data || [] }));
  };

  const handleComment = async (postId: string) => {
    const text = commentInput[postId];
    if (!text) return;

    const newComment = await createComment(postId, text);

    setCommentsMap((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComment],
    }));

    setCommentInput((prev) => ({ ...prev, [postId]: "" }));
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
              className="bg-background shadow-ig rounded-lg overflow-hidden border ring-1 ring-border mb-2"
            >
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
                <div className="relative">
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
                        onClick={() => handleDeletePost(post.id)}
                        className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 w-full text-sm font-semibold transition-all"
                      >
                        <Trash2 size={18} />
                        Xóa bài viết
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* IMAGE WITH DOUBLE CLICK LIKE */}
              {post.image_url && (
                <div
                  className="relative overflow-hidden bg-secondary/20"
                  onDoubleClick={() => handleLike(post.id, true)}
                >
                  <img
                    src={post.image_url}
                    className="w-full aspect-square object-cover cursor-pointer hover:brightness-[0.98] transition-all duration-300 select-none pointer-events-none"
                    alt="Post content"
                  />

                  {/* BIG HEART POP ANIMATION */}
                  {showHeartId === String(post.id) && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      <Heart className="w-24 h-24 text-white fill-white animate-heart-pop opacity-90" />
                    </div>
                  )}

                  {/* Overlay ẩn để catch event tốt hơn */}
                  <div className="absolute inset-0 z-10 cursor-pointer" />
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
                        : "stroke-[2px] text-black"
                    }`}
                  />
                  <MessageCircle
                    onClick={() => loadComments(post.id)}
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
                    <p key={c.id ?? idx} className="text-sm">
                      <span className="font-bold mr-1">
                        {c?.users?.name || "user"}:
                      </span>{" "}
                      {c.content}
                    </p>
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
      {/* FIXED CHAT UI */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-4">
        {/* Khung ChatBox hiện lên khi nhấn nút */}
        {isChatOpen && user && (
          <div className="w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header thanh Chat */}
            <div className="p-3 border-b flex justify-between items-center bg-gray-50">
              <span className="font-bold text-sm">Tin nhắn mới</span>
              <button
                onClick={() => setIsChatOpen(false)}
                className="hover:bg-gray-200 rounded-full p-1 transition-colors"
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
              ? "bg-white text-black border border-gray-200"
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
