"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import Link from "next/link";
import { Bookmark } from "lucide-react";

export default function SavedPage() {
  const [user, setUser] = useState<any>(null);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

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
          setSavedPosts(data);
        }
        if (error) {
          console.error("Error fetching saved posts:", error);
        }
      }
      setLoading(false);
    };

    loadData();
  }, []);

  return (
    <div
      className={`min-h-screen text-foreground transition-colors duration-500 ${isDark ? "bg-neutral-900" : "bg-gray-100"}`}
    >
      <Navbar user={user} />

      <main className="max-w-[935px] mx-auto pt-24 px-4 pb-28 md:pb-20">
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-6">
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
              <Link
                key={item.id}
                href={`/posts/${post.id}`}
                className={`aspect-square overflow-hidden relative group cursor-pointer border border-border/50 rounded-sm transition-colors ${isDark ? "bg-[#262626]" : "bg-white"}`}
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
                <div
                  className={`absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded-full text-xs opacity-0 group-hover:opacity-100 transition ${isDark ? "bg-[#262626]/90 text-white" : "bg-white/90 text-black shadow-sm"}`}
                >
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
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
