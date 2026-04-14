"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Sun,
  Moon,
  Home,
  MessageCircle,
  Heart,
  PlusCircle,
  Bookmark,
  Search,
} from "lucide-react";

export default function Navbar({ user }: any) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ================= THEME =================
  useEffect(() => {
    const root = document.documentElement;
    const theme = localStorage.getItem("theme");

    if (
      theme === "dark" ||
      (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setIsDark(true);
      root.dataset.theme = "dark";
      root.classList.add("dark");
    } else {
      root.dataset.theme = "";
      root.classList.remove("dark");
    }
  }, []);

  const toggleDark = () => {
    const root = document.documentElement;
    const newDark = !isDark;

    setIsDark(newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");

    if (newDark) {
      root.dataset.theme = "dark";
      root.classList.add("dark");
    } else {
      root.dataset.theme = "";
      root.classList.remove("dark");
    }
  };

  // ================= CLICK OUTSIDE =================
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ================= SEARCH =================
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .ilike("name", `%${query}%`)
        .limit(5);

      setResults(data || []);
    }, 300);

    return () => clearTimeout(delay);
  }, [query]);

  // ================= LOGOUT =================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    window.location.reload();
  };

  return (
    <nav
      className={`fixed top-0 w-full z-[9999] shadow-ig transition-colors duration-500 ${isDark ? "bg-neutral-900" : "bg-gray-50"}`}
    >
      <div className="max-w-[935px] mx-auto flex items-center justify-between h-[60px] px-4">
        {/* SEARCH */}
        <div className="hidden md:block relative" ref={searchRef}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search user..."
            className="w-[215px] bg-secondary border border-border px-4 py-[10px] rounded-full text-sm outline-none focus:bg-background transition-colors placeholder:text-muted-foreground text-foreground font-medium"
          />

          {results.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-background/85 backdrop-blur-md border border-border rounded-xl shadow-lg z-50 transition-colors duration-500">
              {results.map((u) => (
                <div
                  key={u.id}
                  onClick={() => {
                    router.push(`/profile/${u.id}`);
                    setResults([]);
                    setQuery("");
                  }}
                  className="flex items-center gap-3 p-2 hover:bg-secondary cursor-pointer"
                >
                  <img
                    src={
                      u.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                    }
                    className="w-7 h-7 rounded-full"
                  />
                  <span className="text-sm">{u.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LOGO */}
        <h1
          className="font-bold text-xl cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => router.push("/")}
        >
          InstaMini
        </h1>

        {/* ICONS */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Ẩn bớt icon trên mobile, đưa xuống bottom nav */}
          <div className="hidden md:flex items-center gap-2">
            <button
              className="p-2 hover:opacity-70 transition-opacity"
              onClick={() => router.push("/")}
            >
              <Home />
            </button>
            <button
              className="p-2 hover:opacity-70 transition-opacity"
              onClick={() => router.push("/messages")}
            >
              <MessageCircle />
            </button>
            <button
              className="p-2 hover:opacity-70 transition-opacity"
              onClick={() => router.push("/notifications")}
            >
              <Heart />
            </button>
            <button
              className="p-2 hover:opacity-70 transition-opacity"
              onClick={() => router.push("/saved")}
            >
              <Bookmark />
            </button>
          </div>
          <button onClick={toggleDark} className="p-2">
            {isDark ? <Sun /> : <Moon />}
          </button>

          {/* USER */}
          <div className="relative" ref={userMenuRef}>
            {user ? (
              <>
                <img
                  onClick={() => setOpen(!open)}
                  src={
                    user?.user_metadata?.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${user.id}`
                  }
                  className="w-8 h-8 rounded-full cursor-pointer"
                />

                {open && (
                  <div className="absolute right-0 mt-2 w-48 bg-background/85 backdrop-blur-md border rounded-xl shadow-ig py-2 transition-colors duration-500">
                    <div className="px-3 py-2 text-sm border-b">
                      {user.email}
                    </div>

                    <button
                      onClick={() => router.push(`/profile/${user.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-secondary"
                    >
                      Hồ sơ
                    </button>

                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() =>
                  supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: window.location.origin },
                  })
                }
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION CHO MOBILE */}
      <div
        className={`md:hidden fixed bottom-0 left-0 w-full border-t border-border flex items-center justify-around h-[60px] z-[9998] transition-colors duration-500 pb-safe ${isDark ? "bg-neutral-900" : "bg-gray-50"}`}
      >
        <button
          className="p-2 hover:bg-secondary rounded-xl transition-colors"
          onClick={() => router.push("/")}
        >
          <Home size={26} />
        </button>
        {/* Nút Search trên điện thoại tạm thời đưa người dùng cuộn lên đỉnh trang */}
        <button
          className="p-2 hover:bg-secondary rounded-xl transition-colors"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <Search size={26} />
        </button>
        <button
          className="p-2 hover:bg-secondary rounded-xl transition-colors"
          onClick={() => router.push("/messages")}
        >
          <MessageCircle size={26} />
        </button>
        <button
          className="p-2 hover:bg-secondary rounded-xl transition-colors"
          onClick={() => router.push("/saved")}
        >
          <Bookmark size={26} />
        </button>
        <button
          className="p-2 hover:bg-secondary rounded-xl transition-colors"
          onClick={() => router.push("/notifications")}
        >
          <Heart size={26} />
        </button>
      </div>
    </nav>
  );
}
