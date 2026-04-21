"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { ChevronLeft, UserPlus, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function SuggestedPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        // Lấy danh sách những người mà mình ĐÃ theo dõi
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);

        const followedSet = new Set((follows || []).map((f) => f.following_id));
        setFollowingIds(followedSet);

        // Lấy danh sách người dùng khác trong hệ thống
        const { data: allUsers } = await supabase
          .from("users")
          .select("id, name, avatar_url, bio")
          .neq("id", user.id)
          .limit(50); // Giới hạn số lượng hiển thị

        setUsers(allUsers || []);
      } else {
        // Nếu chưa đăng nhập, chỉ hiển thị danh sách người dùng
        const { data: allUsers } = await supabase
          .from("users")
          .select("id, name, avatar_url, bio")
          .limit(50);
        setUsers(allUsers || []);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách người dùng:", error);
      toast.error("Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (targetId: string) => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để theo dõi!");
      return;
    }

    const isFollowing = followingIds.has(targetId);

    try {
      if (isFollowing) {
        // Hủy theo dõi
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUser.id)
          .eq("following_id", targetId);

        setFollowingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(targetId);
          return newSet;
        });
      } else {
        // Theo dõi mới
        await supabase.from("follows").insert({
          follower_id: currentUser.id,
          following_id: targetId,
        });

        setFollowingIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(targetId);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Lỗi khi toggle follow:", error);
      toast.error("Đã xảy ra lỗi, vui lòng thử lại!");
    }
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[600px] mx-auto pt-24 px-4 pb-28 md:pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">Khám phá người dùng</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm dark:shadow-black/30 overflow-hidden">
            {users.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                Không có người dùng nào để gợi ý lúc này.
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-neutral-800">
                {users.map((u) => {
                  const isFollowing = followingIds.has(u.id);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors"
                    >
                      <div
                        className="flex items-center gap-4 cursor-pointer flex-1 min-w-0"
                        onClick={() => router.push(`/profile/${u.id}`)}
                      >
                        <img
                          src={
                            u.avatar_url ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                          }
                          className="w-12 h-12 rounded-full border border-gray-200 dark:border-neutral-700 object-cover shadow-sm flex-shrink-0"
                          alt={u.name}
                        />
                        <div className="flex flex-col flex-1 min-w-0 pr-4">
                          <span className="font-semibold text-[15px] truncate text-gray-900 dark:text-gray-100">
                            {u.name}
                          </span>
                          <span className="text-[13px] text-muted-foreground truncate">
                            {u.bio || "Gợi ý kết bạn"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleFollow(u.id)}
                        className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold text-[14px] transition-colors w-[140px] shrink-0
                          ${
                            isFollowing
                              ? "bg-gray-200 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-neutral-600"
                              : "bg-blue-500 text-white hover:bg-blue-600"
                          }`}
                      >
                        {isFollowing ? (
                          <>
                            <Check className="w-4 h-4" />
                            Đang theo dõi
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            Theo dõi
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
