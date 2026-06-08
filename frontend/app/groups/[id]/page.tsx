"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ChevronLeft,
  Globe,
  Lock,
  Users,
  Loader2,
  UserPlus,
  UserCheck,
  UserMinus,
  Clock,
  Settings,
  Image as ImageIcon,
  X,
  Send,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Camera,
  ShieldCheck,
  Edit3,
  UserX,
} from "lucide-react";
import toast from "react-hot-toast";
import { showConfirm } from "@/components/GlobalConfirm";
import { toggleLike } from "@/lib/api";

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ================= ROLE & MEMBERSHIP STATES =================
  const [userRole, setUserRole] = useState<string | null>(null); // 'admin', 'moderator', 'member'
  const [userStatus, setUserStatus] = useState<string | null>(null); // 'approved', 'pending'
  const [memberCount, setMemberCount] = useState(0);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ================= POST STATES =================
  const [posts, setPosts] = useState<any[]>([]);
  const [postContent, setPostContent] = useState("");
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  // ================= SETTINGS STATES =================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<
    "menu" | "edit" | "members" | "requests" | "pending_posts"
  >("menu");
  const [isSaving, setIsSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrivacy, setEditPrivacy] = useState<"public" | "private">(
    "public",
  );
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);

  const [groupMembersList, setGroupMembersList] = useState<any[]>([]);
  const [groupRequestsList, setGroupRequestsList] = useState<any[]>([]);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);

  useEffect(() => {
    const loadGroupData = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (user) {
          const { data: dbUser } = await supabase
            .from("users")
            .select("*")
            .eq("id", user.id)
            .single();
          setCurrentUser({ ...user, ...(dbUser || {}) });
        }

        // 1. Fetch Group Info
        const { data: groupData, error: groupError } = await supabase
          .from("groups")
          .select("*")
          .eq("id", id)
          .single();

        if (groupError) throw groupError;
        setGroup(groupData);

        // 2. Fetch Member Count
        const { count } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", id)
          .eq("status", "approved");
        setMemberCount(count || 0);

        // 3. Fetch User's Membership Status
        let canViewPosts = groupData.privacy === "public";
        if (user) {
          const { data: memberData } = await supabase
            .from("group_members")
            .select("*")
            .eq("group_id", id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (memberData) {
            setUserRole(memberData.role);
            setUserStatus(memberData.status);
            if (memberData.status === "approved") canViewPosts = true;
          }
        }

        // 4. Fetch Posts (If allowed)
        if (canViewPosts) {
          const { data: postsData } = await supabase
            .from("posts")
            .select("*, users(id, name, avatar_url)")
            .eq("group_id", id)
            .or("status.eq.approved,status.is.null")
            .order("created_at", { ascending: false });

          if (postsData && postsData.length > 0) {
            const postIds = postsData.map((p) => p.id);
            const { data: likesRes } = await supabase
              .from("likes")
              .select("post_id, user_id")
              .in("post_id", postIds);

            const likesCountByPost: Record<string, number> = {};
            const userLikedPosts = new Set<string>();

            likesRes?.forEach((l) => {
              likesCountByPost[l.post_id] =
                (likesCountByPost[l.post_id] || 0) + 1;
              if (user && l.user_id === user.id) userLikedPosts.add(l.post_id);
            });

            const enrichedPosts = postsData.map((post) => ({
              ...post,
              likes_count: likesCountByPost[post.id] || 0,
              is_liked: userLikedPosts.has(post.id),
            }));
            setPosts(enrichedPosts);
          }
        }
      } catch (error) {
        console.error("Lỗi tải thông tin nhóm:", error);
        toast.error("Không thể tải thông tin nhóm!");
      } finally {
        setLoading(false);
      }
    };

    if (id) loadGroupData();
  }, [id]);

  // ================= JOIN / LEAVE HANDLERS =================
  const handleJoinGroup = async () => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để tham gia nhóm!");
      return;
    }
    setIsActionLoading(true);
    try {
      const newStatus = group.privacy === "public" ? "approved" : "pending";
      const { error } = await supabase.from("group_members").insert({
        group_id: id,
        user_id: currentUser.id,
        role: "member",
        status: newStatus,
      });
      if (error) throw error;

      setUserStatus(newStatus);
      setUserRole("member");
      if (newStatus === "approved") {
        setMemberCount((prev) => prev + 1);
        toast.success("Đã tham gia nhóm!");
      } else {
        toast.success("Đã gửi yêu cầu tham gia nhóm!");
      }
    } catch (e: any) {
      toast.error(e.message || "Lỗi tham gia nhóm");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLeaveGroup = () => {
    showConfirm(
      userStatus === "pending"
        ? "Bạn muốn hủy yêu cầu tham gia nhóm này?"
        : "Bạn có chắc chắn muốn rời khỏi nhóm này?",
      async () => {
        setIsActionLoading(true);
        try {
          const { error } = await supabase
            .from("group_members")
            .delete()
            .eq("group_id", id)
            .eq("user_id", currentUser.id);
          if (error) throw error;

          if (userStatus === "approved")
            setMemberCount((prev) => Math.max(0, prev - 1));
          setUserStatus(null);
          setUserRole(null);
          toast.success("Đã rời nhóm thành công");
        } catch (e: any) {
          toast.error(e.message || "Lỗi rời nhóm");
        } finally {
          setIsActionLoading(false);
        }
      },
    );
  };

  // ================= POST HANDLERS =================
  const handleCreatePost = async () => {
    if (!postContent && postFiles.length === 0) return;
    setIsPosting(true);
    try {
      let imageUrls: string[] = [];
      if (postFiles.length > 0) {
        const uploadPromises = postFiles.map(async (f) => {
          const cleanName = f.name.replace(/[^a-zA-Z0-9.]/g, "_");
          const fileName = `${Date.now()}_${cleanName}`;
          const { error: uploadError } = await supabase.storage
            .from("posts")
            .upload(fileName, f);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage
            .from("posts")
            .getPublicUrl(fileName);
          return data.publicUrl;
        });
        const results = await Promise.all(uploadPromises);
        imageUrls = results.filter(Boolean) as string[];
      }

      const postStatus =
        userRole === "admin" || userRole === "moderator"
          ? "approved"
          : "pending";
      const { data: newPost, error } = await supabase
        .from("posts")
        .insert({
          content: postContent,
          image_url: imageUrls.length > 0 ? imageUrls[0] : null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
          group_id: id,
          user_id: currentUser.id,
          status: postStatus,
        })
        .select("*, users(id, name, avatar_url)")
        .single();

      if (error) throw error;

      if (postStatus === "approved") {
        setPosts((prev) => [newPost, ...prev]);
        toast.success("Đăng bài thành công!");
      } else {
        toast.success("Bài viết đã được gửi và đang chờ phê duyệt!");
      }

      setPostContent("");
      setPostFiles([]);
    } catch (err: any) {
      toast.error(err.message || "Đăng bài thất bại.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.is_liked;
          return {
            ...p,
            is_liked: isLiked,
            likes_count: isLiked
              ? (p.likes_count || 0) + 1
              : Math.max(0, (p.likes_count || 0) - 1),
          };
        }
        return p;
      }),
    );
    try {
      await toggleLike(postId);
    } catch (error) {
      console.error("Lỗi like:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    showConfirm("Bạn có chắc chắn muốn xóa bài viết này không?", async () => {
      try {
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", postId);
        if (error) throw error;
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success("Đã xóa bài viết");
      } catch (err) {
        toast.error("Xóa bài viết thất bại.");
      }
    });
  };

  // ================= SETTINGS HANDLERS =================
  const openSettings = () => {
    setSettingsView("menu");
    setEditName(group.name || "");
    setEditDesc(group.description || "");
    setEditPrivacy(group.privacy || "public");
    setEditAvatarFile(null);
    setEditCoverFile(null);
    setIsSettingsOpen(true);
  };

  const handleUpdateGroup = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      let payload: any = {
        name: editName.trim(),
        description: editDesc.trim(),
        privacy: editPrivacy,
      };

      if (editAvatarFile) {
        const fileName = `group_avatar_${Date.now()}_${editAvatarFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error } = await supabase.storage
          .from("posts")
          .upload(fileName, editAvatarFile);
        if (!error)
          payload.avatar_url = supabase.storage
            .from("posts")
            .getPublicUrl(fileName).data.publicUrl;
      }

      if (editCoverFile) {
        const fileName = `group_cover_${Date.now()}_${editCoverFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error } = await supabase.storage
          .from("posts")
          .upload(fileName, editCoverFile);
        if (!error)
          payload.cover_url = supabase.storage
            .from("posts")
            .getPublicUrl(fileName).data.publicUrl;
      }

      const { data, error } = await supabase
        .from("groups")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      setGroup(data);
      setSettingsView("menu");
      toast.success("Cập nhật thông tin nhóm thành công!");
    } catch (e) {
      toast.error("Lỗi cập nhật nhóm");
    } finally {
      setIsSaving(false);
    }
  };

  const loadMembersList = async () => {
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, users(id, name, avatar_url)")
        .eq("group_id", id);

      if (error) throw error;
      setGroupMembersList(data?.filter((m) => m.status === "approved") || []);
      setGroupRequestsList(data?.filter((m) => m.status === "pending") || []);
    } catch (e) {
      toast.error("Lỗi tải danh sách thành viên");
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: string) => {
    const executeRoleChange = async () => {
      try {
        const { error } = await supabase
          .from("group_members")
          .update({ role: newRole })
          .eq("group_id", id)
          .eq("user_id", targetUserId);
        if (error) throw error;
        setGroupMembersList((prev) =>
          prev.map((m) =>
            m.user_id === targetUserId ? { ...m, role: newRole } : m,
          ),
        );

        // Nếu tự hạ cấp thành viên, cập nhật quyền và đóng cài đặt
        if (targetUserId === currentUser?.id) {
          setUserRole(newRole);
          if (newRole === "member") setIsSettingsOpen(false);
        }
        toast.success("Đã thay đổi vai trò");
      } catch (e) {
        toast.error("Lỗi khi thay đổi vai trò");
      }
    };

    if (targetUserId === currentUser?.id && newRole !== "admin") {
      const otherAdmins = groupMembersList.filter(
        (m) => m.role === "admin" && m.user_id !== currentUser?.id,
      );
      if (otherAdmins.length === 0) {
        toast.error("Nhóm phải có ít nhất 1 Quản trị viên!");
        return;
      }
      showConfirm(
        "Bạn có chắc chắn muốn tự hạ cấp? Bạn sẽ mất quyền Quản trị viên của nhóm.",
        executeRoleChange,
      );
    } else {
      executeRoleChange();
    }
  };

  const handleProcessRequest = async (
    targetUserId: string,
    action: "approve" | "reject",
  ) => {
    try {
      if (action === "approve") {
        const { error } = await supabase
          .from("group_members")
          .update({ status: "approved" })
          .eq("group_id", id)
          .eq("user_id", targetUserId);
        if (error) throw error;

        const approvedUser = groupRequestsList.find(
          (r) => r.user_id === targetUserId,
        );
        setGroupRequestsList((prev) =>
          prev.filter((r) => r.user_id !== targetUserId),
        );
        if (approvedUser)
          setGroupMembersList((prev) => [
            ...prev,
            { ...approvedUser, status: "approved" },
          ]);
        setMemberCount((prev) => prev + 1);
        toast.success("Đã phê duyệt yêu cầu");
      } else {
        const { error } = await supabase
          .from("group_members")
          .delete()
          .eq("group_id", id)
          .eq("user_id", targetUserId);
        if (error) throw error;
        setGroupRequestsList((prev) =>
          prev.filter((r) => r.user_id !== targetUserId),
        );
        toast.success("Đã từ chối yêu cầu");
      }
    } catch (e) {
      toast.error("Lỗi xử lý yêu cầu");
    }
  };

  const handleRemoveMember = async (
    targetUserId: string,
    targetName: string,
  ) => {
    showConfirm(`Bạn có chắc muốn xóa ${targetName} khỏi nhóm?`, async () => {
      try {
        const { error } = await supabase
          .from("group_members")
          .delete()
          .eq("group_id", id)
          .eq("user_id", targetUserId);
        if (error) throw error;
        setGroupMembersList((prev) =>
          prev.filter((m) => m.user_id !== targetUserId),
        );
        setMemberCount((prev) => Math.max(0, prev - 1));
        toast.success("Đã xóa thành viên khỏi nhóm");
      } catch (e) {
        toast.error("Lỗi xóa thành viên");
      }
    });
  };

  // ================= POST APPROVAL HANDLERS =================
  const loadPendingPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*, users(id, name, avatar_url)")
        .eq("group_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPendingPosts(data || []);
    } catch (e) {
      toast.error("Lỗi tải bài viết chờ duyệt");
    }
  };

  const handleApprovePost = async (postToApprove: any) => {
    try {
      const { error } = await supabase
        .from("posts")
        .update({ status: "approved" })
        .eq("id", postToApprove.id);
      if (error) throw error;
      setPendingPosts((prev) => prev.filter((p) => p.id !== postToApprove.id));
      // Đẩy bài viết vừa duyệt lên đầu bảng tin
      setPosts((prev) =>
        [postToApprove, ...prev].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
      toast.success("Đã phê duyệt bài viết");
    } catch (e) {
      toast.error("Lỗi phê duyệt bài viết");
    }
  };

  const handleRejectPost = async (postId: string) => {
    showConfirm("Từ chối và xóa bài viết này?", async () => {
      try {
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", postId);
        if (error) throw error;
        setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success("Đã từ chối bài viết");
      } catch (e) {
        toast.error("Lỗi từ chối bài viết");
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex justify-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-neutral-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen pt-24 text-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-neutral-900">
        Không tìm thấy nhóm này!
      </div>
    );
  }

  const isAdminOrMod = userRole === "admin" || userRole === "moderator";
  const isApproved = userStatus === "approved";

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900 pb-20">
      {/* Ảnh Bìa (Cover) */}
      <div className="w-full h-[250px] md:h-[400px] bg-gradient-to-r from-indigo-500 to-purple-600 relative group">
        {group.cover_url && (
          <img
            src={group.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        <button
          onClick={() => router.push("/groups")}
          className="absolute top-24 left-4 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-sm transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <main className="max-w-[800px] mx-auto px-4 -mt-16 relative z-10">
        {/* Khung Thông Tin */}
        <div className="bg-white dark:bg-[#262626] rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-neutral-800 flex flex-col md:flex-row items-center md:items-end gap-6 mb-8 text-center md:text-left">
          <img
            src={
              (group.avatar_url && group.avatar_url !== "null"
                ? group.avatar_url
                : null) ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${group.id}`
            }
            alt="Avatar"
            className="w-32 h-32 rounded-full border-4 border-white dark:border-[#262626] object-cover bg-white shadow-md"
          />
          <div className="flex-1 pb-2">
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <div className="flex items-center justify-center md:justify-start gap-4 mt-2 text-sm text-muted-foreground font-medium flex-wrap">
              <span className="flex items-center gap-1.5">
                {group.privacy === "public" ? (
                  <Globe size={16} />
                ) : (
                  <Lock size={16} />
                )}
                {group.privacy === "public"
                  ? "Nhóm công khai"
                  : "Nhóm riêng tư"}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
                <Users size={16} />
                {memberCount.toLocaleString()} thành viên
              </span>
            </div>
            <p className="mt-4 text-gray-700 dark:text-gray-300 text-sm max-w-xl">
              {group.description || "Nhóm này chưa có mô tả nào."}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {currentUser && (
              <>
                {!userStatus ? (
                  <button
                    onClick={handleJoinGroup}
                    disabled={isActionLoading}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <UserPlus className="w-5 h-5" />
                    )}
                    Tham gia nhóm
                  </button>
                ) : (
                  <button
                    onClick={handleLeaveGroup}
                    disabled={isActionLoading}
                    className="flex items-center gap-2 bg-gray-200 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : userStatus === "pending" ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <UserCheck className="w-5 h-5" />
                    )}
                    {userStatus === "pending"
                      ? "Đã gửi yêu cầu"
                      : "Đã tham gia"}
                  </button>
                )}
              </>
            )}

            {isAdminOrMod && (
              <button
                onClick={openSettings}
                className="bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 p-3 rounded-xl transition-all shadow-sm shrink-0"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Feed Section */}
        {group.privacy === "public" || isApproved ? (
          <div className="flex justify-center w-full">
            <div className="w-full max-w-[500px] space-y-4">
              {/* Create Post Input */}
              {isApproved && (
                <div className="shadow-md rounded-2xl p-4 bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 mb-6">
                  <div className="flex items-start gap-3">
                    <img
                      src={
                        (currentUser?.avatar_url &&
                        currentUser.avatar_url !== "null"
                          ? currentUser.avatar_url
                          : null) ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser?.id}`
                      }
                      className="w-10 h-10 rounded-full border object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="Viết điều gì đó cho nhóm..."
                        className="w-full resize-none outline-none min-h-[60px] bg-transparent text-sm pt-1"
                        rows={2}
                      />
                      {postFiles.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
                          {postFiles.map((f, i) => (
                            <div
                              key={i}
                              className="relative inline-block shrink-0"
                            >
                              <img
                                src={URL.createObjectURL(f)}
                                alt="Preview"
                                className="h-20 w-auto rounded-lg object-cover"
                              />
                              <button
                                onClick={() =>
                                  setPostFiles((prev) =>
                                    prev.filter((_, idx) => idx !== i),
                                  )
                                }
                                className="absolute -top-1 -right-1 bg-black/70 text-white rounded-full p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-neutral-800 mt-2">
                        <label className="flex items-center gap-1 text-blue-500 text-sm font-semibold cursor-pointer hover:underline">
                          <ImageIcon size={18} /> Ảnh
                          <input
                            type="file"
                            onChange={(e) => {
                              if (e.target.files) {
                                setPostFiles((prev) => [
                                  ...prev,
                                  ...Array.from(e.target.files as FileList),
                                ]);
                              }
                            }}
                            className="hidden"
                            accept="image/*"
                            multiple
                          />
                        </label>
                        <button
                          onClick={handleCreatePost}
                          disabled={
                            isPosting ||
                            (!postContent && postFiles.length === 0)
                          }
                          className="bg-blue-500 text-white px-5 py-1.5 rounded-full font-bold text-sm hover:bg-blue-600 disabled:opacity-50"
                        >
                          {isPosting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Đăng bài"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* List Posts */}
              {posts.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-[#262626] rounded-2xl border border-gray-200 dark:border-neutral-800 text-muted-foreground">
                  Nhóm chưa có bài viết nào.
                </div>
              ) : (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-800 overflow-hidden"
                  >
                    {/* Post Header */}
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            (post.users?.avatar_url &&
                            post.users.avatar_url !== "null"
                              ? post.users.avatar_url
                              : null) ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user_id}`
                          }
                          className="w-10 h-10 rounded-full object-cover border"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-sm hover:underline cursor-pointer">
                            {post.users?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(post.created_at).toLocaleString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                      </div>
                      {(isAdminOrMod || currentUser?.id === post.user_id) && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    {/* Post Content */}
                    {post.content && (
                      <div className="px-4 pb-3 text-[15px] whitespace-pre-wrap">
                        {post.content}
                      </div>
                    )}
                    {/* Post Image */}
                    {(post.image_urls?.length > 0 || post.image_url) && (
                      <div className="relative flex items-stretch justify-between bg-gray-100 dark:bg-[#1a1a1a] w-full overflow-hidden max-h-[500px]">
                        <img
                          src={post.image_urls?.[0] || post.image_url}
                          className="w-full h-auto max-h-[500px] object-cover transition-all duration-300"
                          alt="Post Image"
                        />
                      </div>
                    )}
                    {/* Actions */}
                    <div className="p-4 border-t border-gray-100 dark:border-neutral-800">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleLike(post.id)}
                          className="flex items-center gap-1.5 transition-transform hover:scale-110"
                        >
                          <Heart
                            className={`w-6 h-6 ${post.is_liked ? "fill-red-500 text-red-500" : "text-gray-900 dark:text-gray-100"}`}
                          />
                          <span className="text-sm font-semibold">
                            {post.likes_count}
                          </span>
                        </button>
                        <button className="flex items-center gap-1.5 hover:opacity-70 transition-opacity">
                          <MessageCircle className="w-6 h-6 text-gray-900 dark:text-gray-100" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground py-16 bg-white dark:bg-[#262626] rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center justify-center">
            <Lock className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Nhóm Riêng Tư
            </h2>
            <p className="max-w-xs">
              Đây là nhóm kín. Bạn cần tham gia và được ban quản trị phê duyệt
              để xem nội dung bài viết.
            </p>
          </div>
        )}
      </main>

      {/* ================= MODAL CÀI ĐẶT NHÓM ================= */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333] shrink-0">
              <div className="flex items-center gap-2">
                {settingsView !== "menu" && (
                  <button
                    onClick={() => setSettingsView("menu")}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-full"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="font-bold text-lg">
                  {settingsView === "menu"
                    ? "Cài đặt nhóm"
                    : settingsView === "edit"
                      ? "Chỉnh sửa thông tin"
                      : settingsView === "members"
                        ? "Thành viên"
                        : "Yêu cầu tham gia"}
                </h2>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 flex-1 overflow-y-auto">
              {settingsView === "menu" && (
                <div className="space-y-3">
                  <button
                    onClick={() => setSettingsView("edit")}
                    className="w-full flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-[#3f3f3f] rounded-xl transition font-semibold"
                  >
                    <Edit3 className="w-5 h-5 text-blue-500" /> Sửa thông tin
                    nhóm
                  </button>
                  <button
                    onClick={() => {
                      loadMembersList();
                      setSettingsView("members");
                    }}
                    className="w-full flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-[#3f3f3f] rounded-xl transition font-semibold"
                  >
                    <Users className="w-5 h-5 text-green-500" /> Quản lý thành
                    viên
                  </button>
                  {group.privacy === "private" && (
                    <button
                      onClick={() => {
                        loadMembersList();
                        setSettingsView("requests");
                      }}
                      className="w-full flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-[#3f3f3f] rounded-xl transition font-semibold"
                    >
                      <UserPlus className="w-5 h-5 text-purple-500" /> Yêu cầu
                      tham gia
                    </button>
                  )}
                  {isAdminOrMod && (
                    <button
                      onClick={() => {
                        loadPendingPosts();
                        setSettingsView("pending_posts");
                      }}
                      className="w-full flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-[#3f3f3f] rounded-xl transition font-semibold"
                    >
                      <Clock className="w-5 h-5 text-orange-500" /> Bài viết chờ
                      duyệt
                    </button>
                  )}
                </div>
              )}

              {settingsView === "edit" && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-24 h-24 rounded-full border-2 border-gray-200 dark:border-neutral-700 bg-gray-100 flex items-center justify-center overflow-hidden">
                      {editAvatarFile || group?.avatar_url ? (
                        <img
                          src={
                            editAvatarFile
                              ? URL.createObjectURL(editAvatarFile)
                              : group.avatar_url
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-8 h-8 text-gray-400" />
                      )}
                      <label className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center text-white opacity-0 hover:opacity-100">
                        <Camera size={20} />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            setEditAvatarFile(e.target.files?.[0] || null)
                          }
                        />
                      </label>
                    </div>
                    <span className="text-xs font-semibold text-blue-500">
                      Ảnh đại diện
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold">Tên nhóm</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border rounded-xl px-4 py-2.5 outline-none bg-gray-50 dark:bg-[#333333] dark:border-neutral-700"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold">Mô tả</label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full border rounded-xl px-4 py-2.5 outline-none resize-none bg-gray-50 dark:bg-[#333333] dark:border-neutral-700"
                      rows={3}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold">Quyền riêng tư</label>
                    <select
                      value={editPrivacy}
                      onChange={(e) =>
                        setEditPrivacy(e.target.value as "public" | "private")
                      }
                      className="w-full border rounded-xl px-4 py-2.5 outline-none bg-gray-50 dark:bg-[#333333] dark:border-neutral-700"
                    >
                      <option value="public">
                        Công khai (Ai cũng có thể xem)
                      </option>
                      <option value="private">
                        Riêng tư (Chỉ thành viên mới xem được bài viết)
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold">Ảnh bìa</label>
                    <div className="relative w-full h-24 bg-gray-100 rounded-xl overflow-hidden border dark:border-neutral-700 flex items-center justify-center">
                      {editCoverFile || group?.cover_url ? (
                        <img
                          src={
                            editCoverFile
                              ? URL.createObjectURL(editCoverFile)
                              : group.cover_url
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-8 h-8 text-gray-400" />
                      )}
                      <label className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center text-white opacity-0 hover:opacity-100">
                        <span className="font-semibold text-sm">
                          Đổi ảnh bìa
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            setEditCoverFile(e.target.files?.[0] || null)
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateGroup}
                    disabled={isSaving}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 mt-4"
                  >
                    {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              )}

              {settingsView === "members" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    <ShieldCheck size={16} /> Quản trị viên & Kiểm duyệt viên
                  </div>
                  <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-neutral-800">
                    {groupMembersList
                      .filter(
                        (m) => m.role === "admin" || m.role === "moderator",
                      )
                      .map((m) => (
                        <div
                          key={m.user_id}
                          className="flex justify-between items-center p-3"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                m.users?.avatar_url ||
                                `https://api.dicebear.com/7.x/identicon/svg?seed=${m.user_id}`
                              }
                              className="w-10 h-10 rounded-full border"
                            />
                            <div>
                              <span className="font-bold text-sm block">
                                {m.users?.name}{" "}
                                {m.user_id === currentUser?.id && "(Bạn)"}
                              </span>
                              <span className="text-xs text-blue-500 font-semibold uppercase">
                                {m.role === "admin"
                                  ? "Quản trị viên"
                                  : "Người kiểm duyệt"}
                              </span>
                            </div>
                          </div>
                          {userRole === "admin" && (
                            <select
                              value={m.role}
                              onChange={(e) =>
                                handleChangeRole(m.user_id, e.target.value)
                              }
                              className="text-xs border p-1 rounded bg-gray-50 dark:bg-neutral-800 dark:border-neutral-700 outline-none font-semibold cursor-pointer"
                            >
                              <option value="admin">Admin</option>
                              <option value="moderator">Mod</option>
                              <option value="member">
                                Hạ cấp xuống Member
                              </option>
                            </select>
                          )}
                        </div>
                      ))}
                  </div>

                  <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 mt-6">
                    <Users size={16} /> Thành viên (
                    {groupMembersList.filter((m) => m.role === "member").length}
                    )
                  </div>
                  <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-neutral-800">
                    {groupMembersList
                      .filter((m) => m.role === "member")
                      .map((m) => (
                        <div
                          key={m.user_id}
                          className="flex justify-between items-center p-3"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                m.users?.avatar_url ||
                                `https://api.dicebear.com/7.x/identicon/svg?seed=${m.user_id}`
                              }
                              className="w-10 h-10 rounded-full border"
                            />
                            <span className="font-bold text-sm">
                              {m.users?.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {userRole === "admin" && (
                              <select
                                value={m.role}
                                onChange={(e) =>
                                  handleChangeRole(m.user_id, e.target.value)
                                }
                                className="text-xs border p-1 rounded bg-gray-50 dark:bg-neutral-800 dark:border-neutral-700 outline-none font-semibold cursor-pointer"
                              >
                                <option value="member">Thành viên</option>
                                <option value="moderator">Thăng cấp Mod</option>
                                <option value="admin">Thăng cấp Admin</option>
                              </select>
                            )}
                            <button
                              onClick={() =>
                                handleRemoveMember(m.user_id, m.users?.name)
                              }
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg"
                            >
                              <UserX size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {settingsView === "requests" && (
                <div className="space-y-2">
                  {groupRequestsList.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                      Không có yêu cầu tham gia nào.
                    </div>
                  ) : (
                    groupRequestsList.map((m) => (
                      <div
                        key={m.user_id}
                        className="flex justify-between items-center p-3 bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              m.users?.avatar_url ||
                              `https://api.dicebear.com/7.x/identicon/svg?seed=${m.user_id}`
                            }
                            className="w-10 h-10 rounded-full border"
                          />
                          <span className="font-bold text-sm">
                            {m.users?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleProcessRequest(m.user_id, "reject")
                            }
                            className="text-sm font-semibold bg-gray-200 dark:bg-neutral-700 px-3 py-1.5 rounded-lg text-gray-700 dark:text-gray-300"
                          >
                            Từ chối
                          </button>
                          <button
                            onClick={() =>
                              handleProcessRequest(m.user_id, "approve")
                            }
                            className="text-sm font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg"
                          >
                            Phê duyệt
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {settingsView === "pending_posts" && (
                <div className="space-y-4">
                  {pendingPosts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                      Không có bài viết nào đang chờ duyệt.
                    </div>
                  ) : (
                    pendingPosts.map((post) => (
                      <div
                        key={post.id}
                        className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={
                              post.users?.avatar_url ||
                              `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user_id}`
                            }
                            className="w-10 h-10 rounded-full border object-cover shrink-0"
                          />
                          <div>
                            <span className="font-bold text-sm block">
                              {post.users?.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.created_at).toLocaleString(
                                "vi-VN",
                              )}
                            </span>
                          </div>
                        </div>
                        {post.content && (
                          <p className="text-sm mb-3 whitespace-pre-wrap">
                            {post.content}
                          </p>
                        )}
                        {(post.image_urls?.length > 0 || post.image_url) && (
                          <div className="relative flex items-stretch justify-between bg-gray-100 dark:bg-[#1a1a1a] w-full overflow-hidden max-h-[300px] mb-3 rounded-lg">
                            <img
                              src={post.image_urls?.[0] || post.image_url}
                              className="w-full h-auto object-cover transition-all duration-300"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800">
                          <button
                            onClick={() => handleRejectPost(post.id)}
                            className="flex-1 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
                          >
                            Từ chối
                          </button>
                          <button
                            onClick={() => handleApprovePost(post)}
                            className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                          >
                            Phê duyệt
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
