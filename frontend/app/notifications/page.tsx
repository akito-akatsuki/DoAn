"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import ChatBox from "@/components/ChatBox";
import { Heart, MessageCircle, MessageSquare, X, UserPlus } from "lucide-react";

export default function NotificationsPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isChatOpen &&
        chatContainerRef.current &&
        !chatContainerRef.current.contains(e.target as Node)
      ) {
        setIsChatOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isChatOpen]);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data } = await supabase.auth.getUser();
    const currentUser = data.user;

    setUser(currentUser);

    if (currentUser) {
      await loadNotifications(currentUser.id);
    }
  };

  const loadNotifications = async (userId: string) => {
    setLoading(true);

    // Nhờ Supabase Database lọc sẵn: Chỉ lấy thông báo KHÁC userId và KHÔNG BỊ NULL
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .neq("sender_id", userId)
      .not("sender_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("notifications error:", JSON.stringify(error, null, 2));
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Tải riêng thông tin của những "người gửi"
    const senderIds = Array.from(new Set(data.map((n) => n.sender_id)));

    let usersData: any[] = [];
    if (senderIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .in("id", senderIds);
      if (users) usersData = users;
    }

    // Ghép thông tin Avatar, Name vào từng thông báo
    const enrichedNotifications = data.map((n) => {
      const senderInfo = usersData.find((u) => u.id === n.sender_id);
      return {
        ...n,
        users: senderInfo || null,
      };
    });

    setNotifications(enrichedNotifications);
    setLoading(false);

    // TỰ ĐỘNG ĐÁNH DẤU ĐÃ ĐỌC KHI MỞ TRANG
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  };

  const iconMap: any = {
    like: <Heart className="text-red-500 w-4 h-4 fill-red-500" />,
    comment: <MessageCircle className="text-blue-500 w-4 h-4 fill-blue-500" />,
    follow: <UserPlus className="text-green-500 w-4 h-4" />,
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[600px] mx-auto pt-24 px-4 pb-28 md:pb-20">
        <h1 className="text-2xl font-bold mb-6">Thông báo</h1>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted"></div>
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            Bạn chưa có thông báo nào.
          </div>
        )}

        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-neutral-800 hover:shadow-sm dark:hover:shadow-black/40 hover:bg-white dark:hover:bg-[#262626] ${!n.is_read ? "bg-blue-50 dark:bg-[#333333]" : ""}`}
            >
              <div className="relative">
                <img
                  src={
                    n.users?.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${n.user_id}`
                  }
                  className="w-11 h-11 rounded-full object-cover ring-1 ring-gray-200 dark:ring-neutral-700 shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 rounded-full p-1 border border-gray-200 dark:border-neutral-700 shadow-sm bg-white dark:bg-[#262626]">
                  {iconMap[n.type] || (
                    <Heart className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight text-foreground">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {n.users?.name || "Người dùng"}
                  </span>{" "}
                  {n.type === "like" && "đã thích bài viết của bạn."}
                  {n.type === "comment" && "đã bình luận về bài viết của bạn."}
                  {n.type === "follow" && "đã bắt đầu theo dõi bạn."}
                </p>

                <p className="text-[12px] text-muted-foreground mt-1">
                  {new Date(
                    n.created_at.includes("Z") || n.created_at.includes("+")
                      ? n.created_at
                      : `${n.created_at}Z`,
                  ).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* FIXED CHAT UI */}
      <div
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[999] flex flex-col items-end gap-4"
        ref={chatContainerRef}
      >
        {isChatOpen && user && (
          <div className="w-[380px] h-[550px] text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl dark:shadow-black/50 border border-gray-200 dark:border-neutral-800 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 transition-colors duration-500 bg-white dark:bg-[#262626]">
            <ChatBox userId={user.id} onClose={() => setIsChatOpen(false)} />
          </div>
        )}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`shadow-2xl transition-all active:scale-90 p-4 rounded-full flex items-center justify-center ${
            isChatOpen
              ? "bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-800"
              : "bg-[#0095F6] text-white hover:bg-blue-600"
          }`}
        >
          {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>
      </div>
    </div>
  );
}
