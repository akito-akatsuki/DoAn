"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";
import ChatBox from "@/components/ChatBox";
import { Heart, MessageCircle, MessageSquare, X, UserPlus } from "lucide-react";

export default function NotificationsPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

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

    const { data, error } = await supabase
      .from("notifications")
      .select(
        `
        id,
        type,
        created_at,
        reference_id,
        user_id,
        users:user_id (
          id,
          name,
          avatar_url
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("notifications error:", JSON.stringify(error, null, 2));
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  };

  const iconMap: any = {
    like: <Heart className="text-red-500 w-4 h-4 fill-red-500" />,
    comment: <MessageCircle className="text-blue-500 w-4 h-4 fill-blue-500" />,
    follow: <UserPlus className="text-green-500 w-4 h-4" />,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-[600px] mx-auto pt-24 px-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Thông báo</h1>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted"></div>
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            Bạn chưa có thông báo nào.
          </div>
        )}

        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer border border-transparent hover:border-border"
            >
              <div className="relative">
                <img
                  src={
                    n.users?.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${n.user_id}`
                  }
                  className="w-11 h-11 rounded-full object-cover ring-1 ring-border"
                />
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-black rounded-full p-1 border border-border shadow-sm">
                  {iconMap[n.type] || (
                    <Heart className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight text-foreground">
                  <span className="font-semibold">
                    {n.users?.name || "Người dùng"}
                  </span>{" "}
                  {n.type === "like" && "đã thích bài viết của bạn."}
                  {n.type === "comment" && "đã bình luận về bài viết của bạn."}
                  {n.type === "follow" && "đã bắt đầu theo dõi bạn."}
                </p>

                <p className="text-[12px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleDateString("vi-VN", {
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
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-4">
        {isChatOpen && user && (
          <div className="w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-3 border-b flex justify-between items-center bg-gray-50">
              <span className="font-bold text-sm">Tin nhắn mới</span>
              <button
                onClick={() => setIsChatOpen(false)}
                className="hover:bg-gray-200 rounded-full p-1 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <ChatBox userId={user.id} />
          </div>
        )}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`shadow-2xl transition-all active:scale-90 p-4 rounded-full flex items-center justify-center ${
            isChatOpen
              ? "bg-white text-black border border-gray-200"
              : "bg-[#0095F6] text-white hover:bg-blue-600"
          }`}
        >
          {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>
      </div>
    </div>
  );
}
