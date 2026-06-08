"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { ChevronLeft, Hash, Loader2 } from "lucide-react";
import Link from "next/link";

export default function HashtagPage({
  params,
}: {
  params: Promise<{ tags: string }>;
}) {
  const { tags } = use(params);
  const decodedTag = decodeURIComponent(tags || "");
  const router = useRouter();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ================= RENDER HASHTAGS =================
  const renderContentWithHashtags = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(#[a-zA-Z0-9_A-Za-zÀ-ỹ]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith("#")) {
        const tagText = part.substring(1);
        return (
          <Link
            key={index}
            href={`/hashtags/${tagText}`}
            className="text-blue-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  useEffect(() => {
    const fetchPostsByHashtag = async () => {
      setLoading(true);
      try {
        // Tìm kiếm các bài viết có nội dung chứa hashtag
        // Lưu ý: Đây là cách tìm kiếm text cơ bản, nếu DB lớn cần dùng Full Text Search
        const { data, error } = await supabase
          .from("posts")
          .select("*, users(id, name, avatar_url), pages(id, name, avatar_url)")
          .ilike("content", `%#${decodedTag}%`)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (error) {
        console.error("Lỗi khi tải bài viết theo hashtag:", error);
      } finally {
        setLoading(false);
      }
    };

    if (decodedTag) fetchPostsByHashtag();
  }, [decodedTag]);

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-neutral-900 pt-24 pb-20 px-4">
      <div className="max-w-[600px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
              <Hash size={24} />
            </div>
            <h1 className="text-2xl font-bold">#{decodedTag}</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-blue-500" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground mt-10">
            Không có bài viết nào chứa hashtag này.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Ở đây bạn có thể tái sử dụng component Post hoặc copy giao diện bài viết từ page.tsx vào */}
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-[#262626] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800"
              >
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={
                      post.users?.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user_id}`
                    }
                    className="w-10 h-10 rounded-full"
                  />
                  <span className="font-bold text-sm">{post.users?.name}</span>
                </div>
                <p className="whitespace-pre-wrap">
                  {renderContentWithHashtags(post.content)}
                </p>
                {post.image_url && (
                  <img
                    src={post.image_url}
                    className="mt-3 rounded-lg w-full max-h-[400px] object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
