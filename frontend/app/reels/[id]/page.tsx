"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ReelsViewer from "@/components/ReelsViewer";

export default function SingleReelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();
        setUser({ ...authUser, ...(dbUser || {}) });
      }

      const { data: reelsData, error } = await supabase
        .from("posts")
        .select("*, users(id, name, avatar_url)")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

      if (!error && reelsData) {
        const postIds = reelsData.map((p) => p.id);
        const { data: likesData } = await supabase
          .from("likes")
          .select("post_id, user_id")
          .in("post_id", postIds);

        const userLikedPosts = new Set(
          likesData
            ?.filter((l) => l.user_id === authUser?.id)
            .map((l) => l.post_id),
        );
        const likesCountByPost: Record<string, number> = {};
        likesData?.forEach((l) => {
          likesCountByPost[l.post_id] = (likesCountByPost[l.post_id] || 0) + 1;
        });

        const enrichedData = reelsData.map((post) => ({
          ...post,
          likes_count:
            likesCountByPost[post.id] !== undefined
              ? likesCountByPost[post.id]
              : post.likes_count || 0,
          is_liked: userLikedPosts.has(post.id),
        }));

        // Sắp xếp video đang được chọn lên đầu tiên để người dùng xem ngay lập tức
        const targetReel = enrichedData.find(
          (r) => String(r.id) === String(id),
        );
        const otherReels = enrichedData.filter(
          (r) => String(r.id) !== String(id),
        );

        if (targetReel) {
          setReels([targetReel, ...otherReels]);
        } else {
          setReels(enrichedData);
        }
      }
      setLoading(false);
    };
    init();
  }, [id]);

  if (loading)
    return (
      <div className="h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center text-gray-900 dark:text-gray-100 transition-colors duration-500">
        Đang tải Reel...
      </div>
    );

  return <ReelsViewer initialReels={reels} initialUser={user} />;
}
