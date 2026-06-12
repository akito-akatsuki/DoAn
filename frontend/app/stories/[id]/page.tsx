"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { X, Loader2, Heart, Send } from "lucide-react";
import toast from "react-hot-toast";
import { getOrCreateConversation, sendMessage } from "@/lib/chatApi";

export default function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [storyInteractions, setStoryInteractions] = useState<{
    views: any[];
    likes: any[];
  }>({ views: [], likes: [] });
  const [showInteractionsModal, setShowInteractionsModal] = useState(false);
  const [isLikingStory, setIsLikingStory] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [storyReplyText, setStoryReplyText] = useState("");

  useEffect(() => {
    const fetchStory = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: dbUser } = await supabase
            .from("users")
            .select("*")
            .eq("id", userData.user.id)
            .single();
          setCurrentUser({ ...userData.user, ...(dbUser || {}) });
        }

        const { data, error } = await supabase
          .from("stories")
          .select("*, users(id, name, avatar_url)")
          .eq("id", id)
          .single();

        if (error || !data) {
          toast.error("Tin này không tồn tại hoặc đã hết hạn.");
          router.push("/");
          return;
        }

        setStory(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchStory();
  }, [id, router]);

  useEffect(() => {
    if (story && currentUser?.id) {
      if (story.user_id !== currentUser.id) {
        // Ghi nhận view
        supabase
          .from("story_views")
          .upsert(
            { story_id: story.id, user_id: currentUser.id },
            { onConflict: "story_id, user_id" },
          )
          .then();

        // Lấy trạng thái like
        supabase
          .from("story_likes")
          .select("story_id")
          .eq("story_id", story.id)
          .eq("user_id", currentUser.id)
          .then(({ data }) => {
            if (data && data.length > 0) setIsLiked(true);
          });
      } else {
        // Nếu là chủ story, lấy danh sách người xem và người thích
        const fetchInteractions = async () => {
          const [viewsRes, likesRes] = await Promise.all([
            supabase
              .from("story_views")
              .select("users(id, name, avatar_url), created_at")
              .eq("story_id", story.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("story_likes")
              .select("users(id, name, avatar_url)")
              .eq("story_id", story.id),
          ]);
          setStoryInteractions({
            views: viewsRes.data || [],
            likes: likesRes.data || [],
          });
        };
        fetchInteractions();
      }
    }
  }, [story, currentUser?.id]);

  const handleLikeStory = async () => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để thả tim!");
      router.push("/login");
      return;
    }
    if (isLikingStory || !story) return;

    setIsLikingStory(true);
    try {
      if (isLiked) {
        await supabase
          .from("story_likes")
          .delete()
          .match({ story_id: story.id, user_id: currentUser.id });
        setIsLiked(false);
      } else {
        await supabase
          .from("story_likes")
          .insert({ story_id: story.id, user_id: currentUser.id });
        setIsLiked(true);
        toast.success("Đã thả tim!");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLikingStory(false);
    }
  };

  const handleReplyStory = async () => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để gửi tin nhắn!");
      router.push("/login");
      return;
    }
    if (!storyReplyText.trim() || !story) return;
    const textToSend = storyReplyText.trim();

    setStoryReplyText("");
    toast.success("Đã gửi tin nhắn!");

    try {
      const convId = await getOrCreateConversation(
        currentUser.id,
        story.user_id,
      );
      const storyPreviewUrl =
        story.media_type !== "text" ? story.media_url : null;
      const content = `Đã trả lời tin của bạn:\n\n"${textToSend}"`;

      await sendMessage(convId, currentUser.id, content, storyPreviewUrl);
    } catch (e) {
      console.error(e);
      toast.error("Gửi tin nhắn thất bại");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center animate-in fade-in">
      {/* Nút Đóng - Quay về trang chủ */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-6 right-4 text-white p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors backdrop-blur-sm z-50"
      >
        <X size={24} />
      </button>

      {/* Header Thông tin User */}
      <div className="absolute top-6 left-4 flex items-center gap-3 z-50">
        <img
          src={
            story.users?.avatar_url ||
            `https://api.dicebear.com/7.x/identicon/svg?seed=${story.users?.id}`
          }
          className="w-10 h-10 rounded-full object-cover border border-white/50 shadow-sm"
          alt="avatar"
        />
        <div className="flex flex-col text-white shadow-sm">
          <span className="font-bold text-sm drop-shadow-md">
            {story.users?.name}
          </span>
          <span className="text-xs opacity-80 drop-shadow-md mt-0.5">
            {new Date(story.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Nội dung Story */}
      <div className="relative w-full max-w-[500px] h-full flex items-center justify-center">
        {story.media_type === "video" ? (
          <video
            src={story.media_url}
            autoPlay
            controls
            className="w-full max-h-full object-contain"
          />
        ) : story.media_type === "image" ? (
          <img
            src={story.media_url}
            className="w-full max-h-full object-contain"
            alt="story"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-blue-600 to-purple-600 p-6">
            <span className="text-white font-medium text-center break-words text-xl opacity-90">
              {story.content}
            </span>
          </div>
        )}

        {/* Text đính kèm trên ảnh/video */}
        {story.content && story.media_type !== "text" && (
          <div className="absolute bottom-24 sm:bottom-12 w-full px-6 text-center z-30 pointer-events-none">
            <span className="bg-black/60 text-white px-4 py-2 rounded-xl inline-block max-w-full break-words text-sm md:text-base">
              {story.content}
            </span>
          </div>
        )}
      </div>

      {/* THANH TƯƠNG TÁC */}
      {currentUser?.id !== story.user_id && (
        <div className="absolute bottom-6 sm:bottom-8 left-4 right-4 z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div
            className="flex-1 bg-black/40 border border-white/30 backdrop-blur-sm rounded-full px-4 py-3 flex items-center cursor-text pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={storyReplyText}
              onChange={(e) => setStoryReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReplyStory()}
              onFocus={(e) => {
                if (!currentUser) {
                  e.target.blur();
                  toast.error("Vui lòng đăng nhập để gửi tin nhắn!");
                  router.push("/login");
                }
              }}
              placeholder={`Gửi tin nhắn cho ${story.users?.name}...`}
              className="bg-transparent outline-none text-white text-sm w-full placeholder:text-white/80"
            />
          </div>
          <button
            className="text-white p-2 hover:scale-110 active:scale-90 transition-transform drop-shadow-md pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              handleLikeStory();
            }}
          >
            <Heart
              size={28}
              className={isLiked ? "fill-red-500 text-red-500" : ""}
            />
          </button>
          <button
            className={`text-white p-2 hover:scale-110 active:scale-90 transition-transform drop-shadow-md pointer-events-auto ${!storyReplyText.trim() ? "opacity-50" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              handleReplyStory();
            }}
            disabled={!storyReplyText.trim()}
          >
            <Send size={28} />
          </button>
        </div>
      )}

      {/* HIỂN THỊ SỐ LƯỢT XEM CHO CHỦ STORY */}
      {currentUser?.id && currentUser.id === story.user_id && (
        <div className="absolute bottom-6 left-0 w-full flex justify-center z-50 animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
          <button
            className="flex items-center gap-2 bg-black/60 hover:bg-black/80 text-white px-4 py-2 rounded-full backdrop-blur-md pointer-events-auto transition-colors shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              setShowInteractionsModal(true);
            }}
          >
            {storyInteractions.views.length > 0 && (
              <div className="flex -space-x-2">
                {storyInteractions.views
                  .slice(0, 3)
                  .map((v: any, i: number) => (
                    <img
                      key={i}
                      src={
                        v.users?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${v.users?.id}`
                      }
                      className="w-6 h-6 rounded-full border border-gray-800 object-cover"
                    />
                  ))}
              </div>
            )}
            <span className="text-sm font-semibold">
              {storyInteractions.views.length} người đã xem
            </span>
          </button>
        </div>
      )}

      {/* MODAL LƯỢT XEM */}
      {showInteractionsModal && (
        <div
          className="absolute inset-x-0 bottom-0 top-1/3 bg-white dark:bg-[#262626] rounded-t-3xl z-[999999] shadow-2xl animate-in slide-in-from-bottom-full duration-300 flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
              Người xem & Lượt thích
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowInteractionsModal(false);
              }}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
            >
              <X size={20} className="text-gray-900 dark:text-gray-100" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {storyInteractions.likes.length > 0 && (
              <div>
                <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Heart size={16} className="text-red-500 fill-red-500" /> Đã
                  thả tim ({storyInteractions.likes.length})
                </h4>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x [&::-webkit-scrollbar]:hidden">
                  {storyInteractions.likes.map((like: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center gap-1.5 w-[60px] shrink-0 snap-start"
                    >
                      <div className="relative">
                        <img
                          src={
                            like.users?.avatar_url ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${like.users?.id}`
                          }
                          className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-neutral-700 shadow-sm"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#262626] rounded-full p-1 shadow-sm">
                          <Heart
                            size={14}
                            className="text-red-500 fill-red-500"
                          />
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-center truncate w-full text-gray-900 dark:text-gray-100">
                        {like.users?.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                Lượt xem ({storyInteractions.views.length})
              </h4>
              {storyInteractions.views.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-gray-50 dark:bg-[#333333] rounded-xl border border-gray-200 dark:border-neutral-800">
                  Chưa có ai xem tin này.
                </p>
              ) : (
                <div className="space-y-3">
                  {storyInteractions.views.map((view: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-[#333333] rounded-xl transition-colors"
                    >
                      <img
                        src={
                          view.users?.avatar_url ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${view.users?.id}`
                        }
                        className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-neutral-700 shadow-sm"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {view.users?.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(view.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
