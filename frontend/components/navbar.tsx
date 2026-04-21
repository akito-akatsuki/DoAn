"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getUserPages } from "@/lib/api";
import {
  Sun,
  Moon,
  Home,
  MessageCircle,
  Heart,
  PlusCircle,
  Bookmark,
  Search,
  Users,
} from "lucide-react";

export default function Navbar({ user: propUser }: any) {
  const [user, setUser] = useState<any>(propUser);
  const router = useRouter();
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [userPages, setUserPages] = useState<any[]>([]);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ================= THEME =================
  useEffect(() => {
    // Ưu tiên đọc từ localStorage (client-side persistence)
    const savedTheme = localStorage.getItem("theme");
    let initialIsDark = false;

    if (savedTheme !== null) {
      initialIsDark = savedTheme === "dark";
    } else {
      // Nếu không có trong localStorage, kiểm tra class 'dark' do SSR đặt
      initialIsDark = document.documentElement.classList.contains("dark");
    }

    setIsDark(initialIsDark);
    const root = document.documentElement;
    if (initialIsDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const fetchUser = async () => {
      if (propUser) {
        setUser(propUser);
      } else {
        try {
          const { data, error } = await supabase.auth.getUser();
          if (error) {
            console.warn("Lỗi xác thực Supabase:", error.message);
            return;
          }
          if (data?.user) {
            const { data: dbUser } = await supabase
              .from("users")
              .select("*")
              .eq("id", data.user.id)
              .single();
            setUser({ ...data.user, ...dbUser });
          }
        } catch (err) {
          console.error("Lỗi mạng khi tải user trên Navbar:", err);
        }
      }
    };
    fetchUser();
  }, [propUser]);

  // ================= LOAD FANPAGES CỦA USER =================
  useEffect(() => {
    if (!user?.id) return;
    const fetchPages = async () => {
      try {
        const pages = await getUserPages();
        setUserPages(pages || []);
      } catch (err) {
        console.error("Lỗi tải danh sách fanpage:", err);
      }
    };
    fetchPages();
  }, [user?.id]);

  // ================= LẮNG NGHE THÔNG BÁO CHƯA ĐỌC =================
  useEffect(() => {
    if (!user?.id) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("sender_id", user.id) // Bỏ qua đếm thông báo do chính mình tạo
        .not("sender_id", "is", null) // Bỏ qua thông báo bị lỗi null
        .eq("is_read", false);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel("nav_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.sender_id && payload.new.sender_id !== user.id) {
            setUnreadCount((prev) => prev + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchUnread(), // Cập nhật lại khi thông báo được đánh dấu đã đọc
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ================= XÓA SỐ THÔNG BÁO KHI VÀO TRANG THÔNG BÁO =================
  useEffect(() => {
    if (pathname === "/notifications") {
      setUnreadCount(0);
    }
  }, [pathname]);

  // ================= PRESENCE (ONLINE STATUS) =================
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel("global_online");
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        for (const key in state) {
          state[key].forEach((presence: any) => {
            if (presence.user_id) onlineIds.add(presence.user_id);
          });
        }
        // Lưu trữ toàn cục & phát sự kiện cho ChatBox
        (window as any).currentOnlineUsers = onlineIds;
        window.dispatchEvent(
          new CustomEvent("presence_sync", { detail: onlineIds }),
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ================= LẮNG NGHE THAY ĐỔI THÔNG TIN USER (AVATAR/NAME) =================
  useEffect(() => {
    if (!user?.id) return;

    const userChannel = supabase
      .channel(`navbar_user_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          // Cập nhật lại state user với dữ liệu mới (avatar_url, name,...)
          setUser((prev: any) => ({ ...prev, ...payload.new }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [user?.id]);

  const toggleDark = () => {
    const root = document.documentElement;
    const newDark = !isDark;

    setIsDark(newDark);

    // LƯU VÀO COOKIE ĐỂ SERVER NEXT.JS ĐỌC ĐƯỢC
    document.cookie = `theme=${newDark ? "dark" : "light"}; path=/; max-age=31536000`;
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

      let userQuery = supabase.from("users").select("id, name, avatar_url");
      let pageQuery = supabase.from("pages").select("id, name, avatar_url");

      const words = query.trim().split(/\s+/);
      words.forEach((word) => {
        userQuery = userQuery.ilike("name", `%${word}%`);
        pageQuery = pageQuery.ilike("name", `%${word}%`);
      });

      const [usersRes, pagesRes] = await Promise.all([
        userQuery.limit(5),
        pageQuery.limit(5),
      ]);

      const usersData = (usersRes.data || []).map((u) => ({
        ...u,
        type: "user",
      }));
      const pagesData = (pagesRes.data || []).map((p) => ({
        ...p,
        type: "page",
      }));

      setResults([...usersData, ...pagesData]);
    }, 300);

    return () => clearTimeout(delay);
  }, [query]);

  // ================= LOGOUT =================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    window.location.reload();
  };

  // ================= CẤU HÌNH TABS CHO ANIMATION TRƯỢT =================
  const desktopTabs = [
    { path: "/", icon: Home },
    { path: "/suggested", icon: Users },
    { path: "/messages", icon: MessageCircle },
    { path: "/notifications", icon: Heart },
    { path: "/saved", icon: Bookmark },
  ];
  const desktopActiveIndex = desktopTabs.findIndex((t) =>
    t.path === "/" ? pathname === "/" : pathname?.startsWith(t.path),
  );

  const mobileTabs = [
    { path: "/", icon: Home },
    { path: "/search", icon: Search },
    { path: "/suggested", icon: Users },
    { path: "/messages", icon: MessageCircle },
    { path: "/saved", icon: Bookmark },
    { path: "/notifications", icon: Heart },
  ];
  const mobileActiveIndex = mobileTabs.findIndex((t) =>
    t.path === "/" ? pathname === "/" : pathname?.startsWith(t.path),
  );

  return (
    <nav className="fixed top-0 w-full z-[9999] shadow-sm dark:shadow-black/30 border-b border-gray-200 dark:border-neutral-800 transition-colors duration-500 bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100">
      <div className="max-w-[935px] mx-auto flex items-center justify-between h-[60px] px-4">
        {/* SEARCH */}
        <div className="hidden md:block relative" ref={searchRef}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim().length > 0) {
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                setResults([]);
              }
            }}
            placeholder="Tìm kiếm "
            className="w-[215px] bg-secondary border border-gray-200 dark:border-neutral-700 shadow-inner px-4 py-[10px] rounded-full text-sm outline-none focus:bg-white dark:focus:bg-[#262626] transition-colors placeholder:text-muted-foreground text-gray-900 dark:text-gray-100 font-medium"
          />

          {results.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white/85 dark:bg-[#262626]/85 backdrop-blur-md border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg dark:shadow-black/50 z-50 transition-colors duration-500">
              {results.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    if (item.type === "page") {
                      router.push(`/fanpage/${item.id}`);
                    } else {
                      router.push(`/profile/${item.id}`);
                    }
                    setResults([]);
                    setQuery("");
                  }}
                  className="flex items-center gap-3 p-2 hover:bg-secondary cursor-pointer"
                >
                  <img
                    src={
                      item.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${item.id}`
                    }
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{item.name}</span>
                    {item.type === "page" && (
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Trang
                      </span>
                    )}
                  </div>
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
          <div className="hidden md:flex items-center relative h-10">
            {/* Sliding indicator cho Desktop */}
            {desktopActiveIndex >= 0 && (
              <div
                className="absolute top-0 left-0 h-10 w-10 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl transition-transform duration-300 ease-out pointer-events-none"
                style={{
                  transform: `translateX(${desktopActiveIndex * 48}px)`,
                }} // 40px width + 8px gap
              />
            )}

            <div className="flex items-center gap-2">
              {desktopTabs.map((tab, idx) => {
                const Icon = tab.icon;
                const active = desktopActiveIndex === idx;
                return (
                  <button
                    key={tab.path}
                    className="relative w-10 h-10 flex items-center justify-center z-10 transition-transform hover:scale-105 active:scale-95"
                    onClick={() => router.push(tab.path)}
                  >
                    <Icon
                      className={`transition-all duration-300 ${
                        active
                          ? "text-cyan-500 fill-cyan-500 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)] scale-110"
                          : "text-gray-900 dark:text-gray-100 hover:opacity-70"
                      }`}
                    />
                    {tab.path === "/notifications" &&
                      unreadCount > 0 &&
                      pathname !== "/notifications" && (
                        <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full pointer-events-none shadow-sm">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                  </button>
                );
              })}
            </div>
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
                    user?.avatar_url ||
                    user?.user_metadata?.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${user.id}`
                  }
                  className={`w-8 h-8 rounded-full cursor-pointer border-[2px] transition-all duration-300 ${pathname?.startsWith("/profile") ? "border-cyan-500 scale-110 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" : "border-transparent hover:scale-105"}`}
                />

                {open && (
                  <div className="absolute right-0 mt-2 w-48 bg-white/85 dark:bg-[#262626]/85 backdrop-blur-md border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg dark:shadow-black/50 py-2 transition-colors duration-500">
                    <div className="px-3 py-2 text-sm border-b">
                      {user.name || user.user_metadata?.name || user.email}
                    </div>

                    <button
                      onClick={() => router.push(`/profile/${user.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-secondary"
                    >
                      Hồ sơ
                    </button>

                    <button
                      onClick={() => {
                        setOpen(false);
                        router.push("/fanpage");
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-secondary"
                    >
                      Tạo Fanpage
                    </button>

                    {userPages.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-neutral-700 my-1 pt-1 pb-1">
                        <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          Trang của bạn
                        </div>
                        {userPages.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setOpen(false);
                              router.push(`/fanpage/${p.id}`);
                            }}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-secondary text-sm transition-colors"
                          >
                            <img
                              src={
                                p.avatar_url ||
                                `https://api.dicebear.com/7.x/identicon/svg?seed=${p.id}`
                              }
                              className="w-6 h-6 rounded-full object-cover border border-gray-200 dark:border-neutral-700 shrink-0"
                              alt="page avatar"
                            />
                            <span className="truncate font-medium">
                              {p.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

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
      <div className="md:hidden fixed bottom-0 left-0 w-full border-t border-gray-200 dark:border-neutral-800 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] dark:shadow-black/30 flex items-center justify-around h-[60px] z-[9998] transition-colors duration-500 pb-safe bg-white dark:bg-[#262626]">
        <div className="relative flex w-full h-full">
          {/* Sliding indicator cho Mobile */}
          {mobileActiveIndex >= 0 && (
            <div
              className="absolute top-0 bottom-0 flex items-center justify-center transition-transform duration-300 ease-out pointer-events-none"
              style={{
                width: `${100 / mobileTabs.length}%`,
                transform: `translateX(${mobileActiveIndex * 100}%)`,
              }}
            >
              <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl" />
            </div>
          )}

          {mobileTabs.map((tab, idx) => {
            const Icon = tab.icon;
            const active = mobileActiveIndex === idx;
            return (
              <button
                key={tab.path}
                className="flex-1 flex items-center justify-center relative z-10 transition-transform active:scale-95"
                onClick={() => router.push(tab.path)}
              >
                <div className="relative">
                  <Icon
                    size={26}
                    className={`transition-all duration-300 ${
                      active
                        ? "text-cyan-500 fill-cyan-500 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)] scale-110"
                        : "text-gray-900 dark:text-gray-100"
                    }`}
                  />
                  {tab.path === "/notifications" &&
                    unreadCount > 0 &&
                    pathname !== "/notifications" && (
                      <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white dark:border-[#262626] pointer-events-none shadow-sm">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
