"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyGroups, getExploreGroups, createGroup } from "@/lib/groupApi";
import toast from "react-hot-toast";
import {
  Users,
  Globe,
  Lock,
  Plus,
  ChevronLeft,
  X,
  Loader2,
  Search,
} from "lucide-react";

export default function GroupsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [exploreGroups, setExploreGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my_groups" | "explore">(
    "my_groups",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Tạo Nhóm States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<"public" | "private">(
    "public",
  );
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        toast.error("Vui lòng đăng nhập để xem nhóm");
        router.push("/");
        return;
      }

      setUser(currentUser);

      try {
        const [myGroupsData, exploreData] = await Promise.all([
          getMyGroups(currentUser.id),
          getExploreGroups(),
        ]);

        setMyGroups(myGroupsData || []);
        setExploreGroups(exploreData || []);
      } catch (error) {
        console.error("Lỗi tải danh sách nhóm:", error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Tên nhóm không được để trống!");
      return;
    }

    setIsCreating(true);
    try {
      const newGroup = await createGroup(
        newGroupName,
        newGroupDesc,
        newGroupPrivacy,
        user.id,
      );
      toast.success("Tạo nhóm thành công!");
      setIsCreateModalOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      setNewGroupPrivacy("public");

      // Thêm nhóm mới vào danh sách hiện tại
      setMyGroups([newGroup, ...myGroups]);
      setActiveTab("my_groups");

      // Chuyển hướng luôn đến trang chi tiết nhóm vừa tạo
      router.push(`/groups/${newGroup.id}`);
    } catch (err) {
      toast.error("Lỗi khi tạo nhóm");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const displayGroups = activeTab === "my_groups" ? myGroups : exploreGroups;
  const filteredGroups = displayGroups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen pt-24 px-4 pb-20 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-[800px] mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="p-2 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-7 h-7 text-blue-500" /> Nhóm cộng đồng
            </h1>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Tạo nhóm
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab("my_groups")}
            className={`pb-3 font-semibold text-[15px] transition-colors border-b-2 ${
              activeTab === "my_groups"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            Nhóm của bạn ({myGroups.length})
          </button>
          <button
            onClick={() => setActiveTab("explore")}
            className={`pb-3 font-semibold text-[15px] transition-colors border-b-2 ${
              activeTab === "explore"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            Khám phá
          </button>
        </div>

        {/* TÌM KIẾM */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 p-3 rounded-xl mb-6 shadow-sm">
          <Search className="text-muted-foreground w-5 h-5 ml-1" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nhóm..."
            className="flex-1 bg-transparent outline-none text-[15px]"
          />
        </div>

        {/* DANH SÁCH NHÓM */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#262626] rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground font-medium">
              Không tìm thấy nhóm nào.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => router.push(`/groups/${group.id}`)}
                className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex gap-4 items-center"
              >
                <img
                  src={
                    (group.avatar_url && group.avatar_url !== "null"
                      ? group.avatar_url
                      : null) ||
                    (group.cover_url && group.cover_url !== "null"
                      ? group.cover_url
                      : null) ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${group.id}`
                  }
                  alt={group.name}
                  className="w-16 h-16 rounded-xl object-cover border border-gray-100 dark:border-neutral-700"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[16px] truncate">
                    {group.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    {group.privacy === "public" ? (
                      <>
                        <Globe className="w-3.5 h-3.5" /> Nhóm công khai
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Nhóm kín
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {group.description || "Chưa có mô tả"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL TẠO NHÓM */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333]">
              <h2 className="font-bold text-lg">Tạo nhóm mới</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="hover:bg-gray-200 dark:hover:bg-neutral-700 p-1.5 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">
                  Tên nhóm <span className="text-red-500">*</span>
                </label>
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Nhập tên nhóm..."
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-xl px-4 py-3 outline-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] transition-colors font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
                  Mô tả nhóm
                </label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Viết vài dòng giới thiệu về nhóm..."
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-xl px-4 py-3 outline-none resize-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] transition-colors"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
                  Quyền riêng tư
                </label>
                <div className="space-y-2 border border-gray-200 dark:border-neutral-700 p-2 rounded-xl shadow-inner bg-gray-50 dark:bg-[#333333]">
                  <div
                    onClick={() => setNewGroupPrivacy("public")}
                    className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-colors ${newGroupPrivacy === "public" ? "bg-white dark:bg-[#262626] border border-blue-200 dark:border-blue-900 shadow-sm" : "hover:bg-gray-100 dark:hover:bg-neutral-700 border border-transparent"}`}
                  >
                    <div className="mt-0.5">
                      <Globe className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-bold text-[14px]">Công khai</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Bất kỳ ai cũng có thể tìm thấy nhóm và xem thành viên,
                        bài viết.
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() => setNewGroupPrivacy("private")}
                    className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-colors ${newGroupPrivacy === "private" ? "bg-white dark:bg-[#262626] border border-blue-200 dark:border-blue-900 shadow-sm" : "hover:bg-gray-100 dark:hover:bg-neutral-700 border border-transparent"}`}
                  >
                    <div className="mt-0.5">
                      <Lock className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-bold text-[14px]">Riêng tư (Kín)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Chỉ thành viên mới có thể xem các bài viết bên trong
                        nhóm.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-3 bg-gray-50 dark:bg-[#333333]">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || isCreating}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}{" "}
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
