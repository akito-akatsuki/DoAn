"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, Loader2 } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
        setLoading(false);
        return;
      }

      setLoading(true);
      let dbQuery = supabase
        .from("users")
        .select("id, name, avatar_url")
        .ilike("name", `%${query}%`);

      if (currentUserId) {
        dbQuery = dbQuery.neq("id", currentUserId);
      }

      const { data } = await dbQuery.limit(10);

      setResults(data || []);
      setLoading(false);
    }, 300);

    return () => clearTimeout(delay);
  }, [query, currentUserId]);

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

        {query.length >= 2 && results.length === 0 && !loading && (
          <div className="text-center py-10 text-muted-foreground">
            Không tìm thấy người dùng nào.
          </div>
        )}

        <div className="space-y-2">
          {results.map((u) => (
            <div
              key={u.id}
              onClick={() => router.push(`/profile/${u.id}`)}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-white dark:hover:bg-[#262626] cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-neutral-800 hover:shadow-sm"
            >
              <img
                src={
                  u.avatar_url ||
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                }
                className="w-12 h-12 rounded-full object-cover ring-1 ring-gray-200 dark:ring-neutral-700 shadow-sm"
              />
              <span className="font-semibold text-base">{u.name}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
