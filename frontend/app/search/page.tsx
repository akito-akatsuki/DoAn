"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { Suspense } from "react";

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "user" | "page">("all");
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        setSuggestedName(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      let dbQuery = supabase.from("users").select("id, name, avatar_url");

      let pageQuery = supabase.from("pages").select("id, name, avatar_url");

      const words = query.trim().split(/\s+/);
      words.forEach((word) => {
        dbQuery = dbQuery.ilike("name", `%${word}%`);
        pageQuery = pageQuery.ilike("name", `%${word}%`);
      });

      if (currentUserId) {
        dbQuery = dbQuery.neq("id", currentUserId);
      }

      const [userRes, pageRes] = await Promise.all([
        dbQuery.limit(10),
        pageQuery.limit(10),
      ]);

      const usersData = (userRes.data || []).map((u) => ({
        ...u,
        type: "user",
      }));
      const pagesData = (pageRes.data || []).map((p) => ({
        ...p,
        type: "page",
      }));

      const totalResults = [...usersData, ...pagesData];
      setResults(totalResults);
      setLoading(false);

      // AI Suggestion khi không có kết quả
      if (totalResults.length === 0 && query.trim().length >= 2) {
        setLoadingSuggestion(true);
        try {
          const res = await fetch("/api/suggest-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query.trim() }),
          });
          const data = await res.json();
          setSuggestedName(data.suggestion || null);
        } catch (e) {
          setSuggestedName(null);
        } finally {
          setLoadingSuggestion(false);
        }
      } else {
        setSuggestedName(null);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [query, currentUserId]);

  const filteredResults = results.filter(
    (item) => filter === "all" || item.type === filter,
  );

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[600px] mx-auto pt-24 px-4 pb-28 md:pb-20">
        <h1 className="text-2xl font-bold mb-6">Tìm kiếm</h1>

        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim().length > 0) {
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                (e.target as HTMLInputElement).blur(); // Ẩn bàn phím ảo trên điện thoại sau khi tìm kiếm
              }
            }}
            placeholder="Tìm kiếm người dùng..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-700 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium placeholder:text-muted-foreground text-gray-900 dark:text-gray-100"
            autoFocus
          />
          {loading && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
            </div>
          )}
        </div>

        {/* BỘ LỌC TÌM KIẾM */}
        {query.length >= 2 && results.length > 0 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${filter === "all" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-md" : "bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-neutral-700"}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilter("user")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${filter === "user" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-md" : "bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-neutral-700"}`}
            >
              Người dùng
            </button>
            <button
              onClick={() => setFilter("page")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${filter === "page" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-md" : "bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-neutral-700"}`}
            >
              Trang cộng đồng
            </button>
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <div className="text-center py-10 text-muted-foreground flex flex-col gap-2">
            <span>Không tìm thấy kết quả nào.</span>
            {loadingSuggestion ? (
              <span className="text-sm animate-pulse text-blue-500">
                Đang nhờ AI gợi ý tên...
              </span>
            ) : suggestedName ? (
              <span className="text-sm">
                Có phải bạn muốn tìm:{" "}
                <button
                  className="font-bold text-blue-500 hover:underline"
                  onClick={() => setQuery(suggestedName)}
                >
                  {suggestedName}
                </button>
                ?
              </span>
            ) : null}
          </div>
        )}

        {query.length >= 2 &&
          results.length > 0 &&
          filteredResults.length === 0 &&
          !loading && (
            <div className="text-center py-10 text-muted-foreground">
              Không tìm thấy kết quả phù hợp với bộ lọc.
            </div>
          )}

        <div className="space-y-2">
          {filteredResults.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() => {
                if (item.type === "page") {
                  router.push(`/fanpage/${item.id}`);
                } else {
                  router.push(`/profile/${item.id}`);
                }
              }}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-white dark:hover:bg-[#262626] cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-neutral-800 hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                <img
                  src={
                    item.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${item.id}`
                  }
                  className="w-12 h-12 rounded-full object-cover ring-1 ring-gray-200 dark:ring-neutral-700 shadow-sm"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-base">{item.name}</span>
                  {item.type === "page" && (
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Trang cộng đồng
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-24 text-center">Đang tải...</div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
