"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Heart,
  MessageCircle,
  Share,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  X,
  Send,
  Play,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleLike, getComments, createComment } from "@/lib/api";
import toast from "react-hot-toast";

interface ReelsViewerProps {
  initialReels: any[];
  initialUser: any | null;
}

export default function ReelsViewer({
  initialReels,
  initialUser,
}: ReelsViewerProps) {
  const [reels, setReels] = useState<any[]>(initialReels);
  const [user, setUser] = useState<any>(initialUser);
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [playingState, setPlayingState] = useState<Record<string, boolean>>({});
  const [showHeartId, setShowHeartId] = useState<string | null>(null);
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    setReels(initialReels);
  }, [initialReels]);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.7,
    };

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    videoRefs.current.forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => observer.disconnect();
  }, [reels]);

  const handleLike = async (postId: string, isDoubleClick = false) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thả tim");
      return;
    }

    if (isDoubleClick) {
      setShowHeartId(postId);
      setTimeout(() => setShowHeartId(null), 1000);
    }

    const currentReel = reels.find((r) => r.id === postId);
    if (isDoubleClick && currentReel?.is_liked) {
      return; // Tránh việc hủy thả tim (unlike) nếu người dùng nhấp đúp vào video đã thả tim
    }

    setReels((prev) =>
      prev.map((r) => {
        if (r.id === postId) {
          return {
            ...r,
            is_liked: !r.is_liked,
            likes_count: r.is_liked
              ? Math.max(0, (r.likes_count || 0) - 1)
              : (r.likes_count || 0) + 1,
          };
        }
        return r;
      }),
    );
    try {
      await toggleLike(postId);
    } catch (e) {}
  };

  const openComments = async (postId: string) => {
    if (openCommentsId === postId) {
      setOpenCommentsId(null);
      return;
    }
    setOpenCommentsId(postId);
    const data = await getComments(postId);
    setComments(data || []);
  };

  const handleComment = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để bình luận");
      return;
    }
    if (!commentText.trim() || !openCommentsId) return;

    const text = commentText;
    setCommentText("");

    const tempComment = {
      id: `temp-${Date.now()}`,
      content: text,
      user_id: user.id,
      users: {
        id: user.id,
        name: user.name || "Bạn",
        avatar_url: user.avatar_url,
      },
    };
    setComments((prev) => [...prev, tempComment]);

    try {
      const newCmt = await createComment(openCommentsId, text);
      setComments((prev) =>
        prev.map((c) => (c.id === tempComment.id ? newCmt : c)),
      );
    } catch (err) {
      toast.error("Bình luận thất bại");
    }
  };

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      navigator.share({ title: "Apex Reels", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Đã sao chép liên kết!");
    }
  };

  const scrollToReel = (direction: "next" | "prev") => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const targetScroll =
      direction === "next"
        ? scrollTop + clientHeight
        : scrollTop - clientHeight;
    containerRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
  };

  return (
    <div
      ref={containerRef}
      className="h-[calc(100dvh-120px)] md:h-[calc(100dvh-60px)] mt-[60px] w-full bg-gray-50 dark:bg-neutral-900 overflow-y-scroll snap-y snap-mandatory relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-colors duration-500"
    >
      <button
        onClick={() => router.push("/")}
        className="fixed top-[76px] left-4 z-[60] p-3 bg-gray-200/80 dark:bg-black/40 rounded-full text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-black/60 transition-colors hidden sm:block backdrop-blur-md shadow-lg"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Nút chuyển video */}
      <div className="fixed right-2 sm:right-6 top-1/2 -translate-y-1/2 hidden sm:flex flex-col gap-4 z-[50] pointer-events-auto">
        <button
          onClick={() => scrollToReel("prev")}
          className="p-3 bg-gray-200/80 dark:bg-black/40 hover:bg-gray-300 dark:hover:bg-black/60 text-gray-900 dark:text-white rounded-full transition-colors backdrop-blur-md shadow-lg"
        >
          <ChevronUp size={24} />
        </button>
        <button
          onClick={() => scrollToReel("next")}
          className="p-3 bg-gray-200/80 dark:bg-black/40 hover:bg-gray-300 dark:hover:bg-black/60 text-gray-900 dark:text-white rounded-full transition-colors backdrop-blur-md shadow-lg"
        >
          <ChevronDown size={24} />
        </button>
      </div>

      {reels.map((reel, index) => (
        <div
          key={reel.id}
          className="h-[calc(100dvh-120px)] md:h-[calc(100dvh-60px)] w-full snap-start relative flex items-center justify-center bg-gray-50 dark:bg-neutral-900 overflow-hidden transition-colors duration-500"
        >
          <div className="flex w-full sm:w-auto h-full py-0 sm:py-4 justify-center items-center transition-all duration-500 ease-out">
            {/* Khung Video + Action */}
            <div className="flex w-full h-full sm:w-[450px] md:w-[500px] shrink-0 relative transition-all duration-500">
              {/* Video container */}
              <div className="relative w-full h-full bg-black sm:bg-black sm:rounded-2xl overflow-hidden flex items-center justify-center shadow-lg group">
                <video
                  ref={(el) => {
                    videoRefs.current[index] = el;
                  }}
                  src={reel.video_url}
                  className="w-full h-full object-cover"
                  loop
                  playsInline
                  onLoadedMetadata={(e) => {
                    const video = e.target as HTMLVideoElement;
                    // Tự động kiểm tra tỷ lệ khung hình video
                    if (video.videoWidth > video.videoHeight) {
                      video.style.objectFit = "contain"; // Video ngang không bị cắt xén
                    } else {
                      video.style.objectFit = "cover"; // Video dọc lấp đầy khung hình
                    }
                  }}
                  onPlay={() =>
                    setPlayingState((prev) => ({ ...prev, [reel.id]: true }))
                  }
                  onPause={() =>
                    setPlayingState((prev) => ({ ...prev, [reel.id]: false }))
                  }
                  onClick={(e) => {
                    const video = e.target as HTMLVideoElement;
                    if (clickTimeout.current) {
                      // Nhấp đúp (Double click)
                      clearTimeout(clickTimeout.current);
                      clickTimeout.current = null;
                      handleLike(reel.id, true);
                    } else {
                      // Nhấp đơn (Single click)
                      clickTimeout.current = setTimeout(() => {
                        if (video.paused) video.play();
                        else video.pause();
                        clickTimeout.current = null;
                      }, 250); // Trì hoãn 250ms để chờ xem có click lần 2 hay không
                    }
                  }}
                />

                {/* Heart Animation Overlay */}
                {showHeartId === reel.id && (
                  <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <Heart className="w-28 h-28 text-white fill-white drop-shadow-[0_0_15px_rgba(0,0,0,0.4)] animate-heart-pop opacity-90" />
                  </div>
                )}

                {/* Play Icon Overlay */}
                {!playingState[reel.id] && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 animate-in zoom-in-95 duration-200">
                    <div className="bg-black/40 backdrop-blur-[2px] w-24 h-24 flex items-center justify-center rounded-full text-white/90 shadow-2xl">
                      <Play size={48} className="fill-current ml-2" />
                    </div>
                  </div>
                )}

                {/* Info Overlay (Bên trong đáy Video) */}
                <div className="absolute bottom-0 left-0 right-0 p-4 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none flex flex-col justify-end">
                  <div className="text-white pointer-events-auto pr-16 pb-4">
                    <div
                      className="flex items-center gap-3 mb-3 cursor-pointer w-fit"
                      onClick={() => router.push(`/profile/${reel.user_id}`)}
                    >
                      <img
                        src={
                          reel.users?.avatar_url ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${reel.user_id}`
                        }
                        className="w-10 h-10 rounded-full border border-white/50 object-cover"
                      />
                      <span className="font-bold text-base drop-shadow-md">
                        {reel.users?.name}
                      </span>
                      {user?.id !== reel.user_id && (
                        <button className="px-3 py-1 border border-white rounded-full text-xs font-semibold backdrop-blur-sm hover:bg-white/20 transition-colors">
                          Theo dõi
                        </button>
                      )}
                    </div>
                    <p className="text-sm drop-shadow-md line-clamp-2">
                      {reel.content}
                    </p>
                  </div>
                </div>

                {/* Cột Nút Tương Tác Overlay */}
                <div className="absolute bottom-0 right-0 w-[60px] sm:w-[70px] flex flex-col items-center justify-end pb-8 gap-6 z-20 pointer-events-auto h-full">
                  <div
                    className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => handleLike(reel.id)}
                  >
                    <div className="p-3 bg-black/20 backdrop-blur-sm rounded-full transition-colors">
                      <Heart
                        size={26}
                        className={
                          reel.is_liked
                            ? "fill-red-500 text-red-500"
                            : "text-white"
                        }
                      />
                    </div>
                    <span className="text-white text-xs font-bold drop-shadow-md">
                      {reel.likes_count || 0}
                    </span>
                  </div>

                  <div
                    className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => openComments(reel.id)}
                  >
                    <div className="p-3 bg-black/20 backdrop-blur-sm rounded-full transition-colors">
                      <MessageCircle size={26} className="text-white" />
                    </div>
                    <span className="text-white text-xs font-bold drop-shadow-md">
                      Bình luận
                    </span>
                  </div>

                  <div
                    className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => handleShare(reel.id)}
                  >
                    <div className="p-3 bg-black/20 backdrop-blur-sm rounded-full transition-colors">
                      <Share size={26} className="text-white" />
                    </div>
                    <span className="text-white text-xs font-bold drop-shadow-md">
                      Chia sẻ
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Khung Comments Panel (Trượt ngang) */}
            <div
              className={`h-full bg-white dark:bg-[#262626] sm:rounded-2xl border-gray-200 dark:border-neutral-800 flex flex-col transition-all duration-500 ease-out overflow-hidden z-30 shrink-0
                ${
                  openCommentsId === reel.id
                    ? "absolute inset-0 w-full sm:relative sm:w-[350px] md:w-[400px] opacity-100 sm:ml-2 sm:border z-[60]"
                    : "absolute sm:relative w-0 opacity-0 ml-0 border-0"
                }
              `}
            >
              <div className="w-screen sm:w-[350px] md:w-[400px] h-full flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333] sm:rounded-t-2xl shrink-0">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                    Bình luận
                  </h3>
                  <button
                    onClick={() => setOpenCommentsId(null)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-full transition-colors text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {comments.length === 0 ? (
                    <div className="text-center text-muted-foreground mt-10">
                      Chưa có bình luận nào. Hãy là người đầu tiên!
                    </div>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <img
                          src={
                            c.users?.avatar_url ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`
                          }
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200 dark:border-neutral-700"
                        />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 mb-0.5">
                            {c.users?.name || "Người dùng"}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {c.content}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 border-t border-gray-200 dark:border-neutral-800 flex items-center gap-3 bg-gray-50 dark:bg-[#333333] sm:rounded-b-2xl shrink-0">
                  <img
                    src={
                      user?.avatar_url ||
                      (user
                        ? `https://api.dicebear.com/7.x/identicon/svg?seed=${user.id}`
                        : "/sukhoi.jpg")
                    }
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-300 dark:border-neutral-600"
                  />
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={
                      user ? "Thêm bình luận..." : "Đăng nhập để bình luận"
                    }
                    disabled={!user}
                    onKeyDown={(e) => e.key === "Enter" && handleComment()}
                    className="flex-1 bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-700 rounded-full px-4 py-2 text-sm outline-none text-gray-900 dark:text-gray-100 shadow-inner"
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="p-2.5 bg-blue-500 text-white rounded-full disabled:opacity-50 hover:bg-blue-600 transition-colors shadow-md"
                  >
                    <Send size={16} className="-ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      {reels.length === 0 && (
        <div className="h-screen flex items-center justify-center text-gray-900 dark:text-gray-100 transition-colors duration-500">
          Chưa có video Reels nào!
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
