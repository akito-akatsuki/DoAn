"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ShieldCheck,
  Image as ImageIcon,
  Settings,
  Users,
  Edit3,
  Trash2,
  Camera,
  Loader2,
  X,
  Search,
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Bookmark,
  Flag,
  Smile,
  Pencil,
  UserPlus,
  UserCheck,
  Star,
  Check,
  UserMinus,
  ChevronRight,
} from "lucide-react";
import {
  updatePageInfo,
  getPageAdmins,
  addPageAdmin,
  removePageAdmin,
  deletePage,
  getPageMembers,
  removePageMember,
  getComments,
  createComment,
  createPost,
  deleteComment,
  updateComment,
  toggleLike,
  toggleSavePost,
  reportPost,
  reportComment,
  submitAppeal,
} from "@/lib/api";
import toast from "react-hot-toast";
import { showConfirm } from "@/components/GlobalConfirm";

export default function FanpageProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [pageInfo, setPageInfo] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ================= FOLLOW STATES =================
  const [memberCount, setMemberCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followType, setFollowType] = useState<"normal" | "favorites">(
    "normal",
  );
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showFollowMenu, setShowFollowMenu] = useState(false);
  const followMenuRef = useRef<HTMLDivElement | null>(null);

  // ================= SETTINGS STATES =================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<"menu" | "edit" | "admins">(
    "menu",
  );
  const [pageAdmins, setPageAdmins] = useState<any[]>([]);
  const [pageMembers, setPageMembers] = useState<any[]>([]);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminSearchResults, setAdminSearchResults] = useState<any[]>([]);
  const [editPostPermission, setEditPostPermission] = useState<
    "admin_only" | "anyone"
  >("anyone");
  const [isSaving, setIsSaving] = useState(false);

  // ================= DRAG COVER STATES =================
  const [editCoverPositionY, setEditCoverPositionY] = useState(50);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);

  // ================= POST INTERACTIONS STATES =================
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [commentFileMap, setCommentFileMap] = useState<
    Record<string, File | null>
  >({});
  const [modalCommentFile, setModalCommentFile] = useState<File | null>(null);
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [showHeartId, setShowHeartId] = useState<string | null>(null);
  const imageClickTimeout = useRef<NodeJS.Timeout | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<
    Record<string, number>
  >({});

  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");

  // ================= CREATE POST & REPORT STATES =================
  const [postContent, setPostContent] = useState("");
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"post" | "comment">("post");
  const [reportReason, setReportReason] = useState("");

  // ================= APPEAL POST STATES =================
  const [appealPostId, setAppealPostId] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState("");

  // ================= MODAL POST STATES =================
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [modalCommentText, setModalCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [openPostMenu, setOpenPostMenu] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const modalInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});

  // ================= CLICK OUTSIDE =================
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        openMenuId &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpenMenuId(null);
      }
      setOpenCommentMenuId(null);
      setOpenPostMenu(false);

      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }

      if (
        showFollowMenu &&
        followMenuRef.current &&
        !followMenuRef.current.contains(e.target as Node)
      ) {
        setShowFollowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId, showEmojiPicker, showFollowMenu]);

  // ================= CHẶN LƯỚT BACKGROUND KHI MỞ MODAL =================
  useEffect(() => {
    if (selectedPost) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPost]);

  // ================= LOAD DATA =================
  const loadCommentsList = async (postId: string) => {
    const data = await getComments(postId);
    setCommentsMap((prev) => ({ ...prev, [postId]: data || [] }));
  };

  useEffect(() => {
    const loadPageData = async () => {
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

        // 1. Lấy thông tin Fanpage
        const { data: pageData, error: pageError } = await supabase
          .from("pages")
          .select("*")
          .eq("id", id)
          .single();

        if (pageError) throw pageError;
        setPageInfo(pageData);

        // 2. Kiểm tra xem user hiện tại có phải là Admin của page không
        if (user && pageData) {
          const { data: adminData } = await supabase
            .from("page_admins")
            .select("*")
            .eq("page_id", id)
            .eq("user_id", user.id)
            .maybeSingle();

          // Luôn đảm bảo Người tạo ra trang có quyền Admin tuyệt đối
          if (adminData || pageData.created_by === user.id) setIsAdmin(true);
        }

        // Lấy số lượng thành viên và trạng thái theo dõi
        const { count: memberCountData } = await supabase
          .from("page_members")
          .select("*", { count: "exact", head: true })
          .eq("page_id", id);
        setMemberCount(memberCountData || 0);

        if (user) {
          const { data: memberData, error: memberError } = await supabase
            .from("page_members")
            .select("id, follow_type")
            .eq("page_id", id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (memberError && memberError.code === "PGRST206") {
            const { data: fallbackData } = await supabase
              .from("page_members")
              .select("id")
              .eq("page_id", id)
              .eq("user_id", user.id)
              .maybeSingle();
            if (fallbackData) setIsFollowing(true);
          } else if (memberData) {
            setIsFollowing(true);
            if (memberData.follow_type) {
              setFollowType(memberData.follow_type);
            }
          }
        }

        // 3. Lấy danh sách bài viết của Page (Kèm thông tin người đã đăng)
        const { data: postsData } = await supabase
          .from("posts")
          .select(
            "id, content, image_url, image_urls, created_at, is_flagged, user_id, users (id, name, avatar_url)",
          )
          .eq("page_id", id)
          .order("created_at", { ascending: false });

        const postIds = (postsData || []).map((p: any) => p.id);

        if (postIds.length > 0) {
          const [commentsRes, likesRes, savedRes] = await Promise.all([
            supabase
              .from("comments")
              .select("*, users (id, name, avatar_url)")
              .in("post_id", postIds)
              .order("created_at", { ascending: true }),
            supabase
              .from("likes")
              .select("post_id, user_id")
              .in("post_id", postIds),
            user
              ? supabase
                  .from("saved_posts")
                  .select("post_id")
                  .eq("user_id", user.id)
                  .in("post_id", postIds)
              : Promise.resolve({ data: [] }),
          ]);

          const commentsByPost: Record<string, any[]> = {};
          commentsRes.data?.forEach((c) => {
            if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
            commentsByPost[c.post_id].push(c);
          });
          setCommentsMap((prev) => ({ ...prev, ...commentsByPost }));

          const likesCountByPost: Record<string, number> = {};
          const userLikedPosts = new Set<string>();
          likesRes.data?.forEach((l) => {
            likesCountByPost[l.post_id] =
              (likesCountByPost[l.post_id] || 0) + 1;
            if (user && l.user_id === user.id) userLikedPosts.add(l.post_id);
          });

          const userSavedPosts = new Set<string>(
            (savedRes.data || []).map((s: any) => s.post_id),
          );

          const enrichedData = postsData!
            .map((post: any) => ({
              ...post,
              pages: pageData,
              likes_count: likesCountByPost[post.id] || 0,
              is_liked: userLikedPosts.has(post.id),
              is_saved: userSavedPosts.has(post.id),
            }))
            .filter(
              (post: any) =>
                !post.is_flagged || post.user_id === user?.id || isAdmin,
            );

          setPosts(enrichedData);
        } else {
          setPosts([]);
        }
      } catch (error) {
        console.error("Lỗi tải trang Fanpage:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadPageData();
  }, [id]);

  // ================= SEARCH ADMINS =================
  useEffect(() => {
    const t = setTimeout(async () => {
      if (adminSearchQuery.length < 2) return setAdminSearchResults([]);

      let dbQuery = supabase.from("users").select("id, name, avatar_url");

      const words = adminSearchQuery.trim().split(/\s+/);
      words.forEach((word) => {
        dbQuery = dbQuery.ilike("name", `%${word}%`);
      });

      const { data } = await dbQuery.limit(5);

      setAdminSearchResults(data || []);
    }, 300);

    return () => clearTimeout(t);
  }, [adminSearchQuery]);

  // ================= SETTINGS HANDLERS =================
  const handleOpenSettings = () => {
    setSettingsView("menu");
    setEditName(pageInfo?.name || "");
    setEditBio(pageInfo?.bio || "");
    setEditCoverFile(null);
    setEditAvatarFile(null);
    setEditCoverPositionY(pageInfo?.cover_position_y ?? 50);
    setEditPostPermission(pageInfo?.post_permission || "anyone");
    setIsSettingsOpen(true);
  };

  const handleDragStart = (clientY: number) => {
    setIsDraggingCover(true);
    setDragStartY(clientY);
  };

  const handleDragMove = (clientY: number) => {
    if (!isDraggingCover) return;
    const deltaY = clientY - dragStartY;
    const deltaPercent = (deltaY / 128) * 100; // 128px là chiều cao container (h-32)
    setEditCoverPositionY((prev) =>
      Math.max(0, Math.min(100, prev - deltaPercent)),
    );
    setDragStartY(clientY);
  };

  const handleDragEnd = () => setIsDraggingCover(false);

  const handleUpdatePage = async () => {
    if (!pageInfo || !editName.trim()) return;
    setIsSaving(true);
    try {
      let payload: any = {
        name: editName.trim(),
        bio: editBio.trim(),
        // cover_position_y: editCoverPositionY, // Bỏ comment sau khi đã thêm cột cover_position_y vào bảng pages trong Supabase
        cover_position_y: editCoverPositionY,
        post_permission: editPostPermission,
      };

      // Upload Avatar
      if (editAvatarFile) {
        const fileName = `page_avatar_${Date.now()}_${editAvatarFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error } = await supabase.storage
          .from("posts")
          .upload(fileName, editAvatarFile);
        if (!error) {
          payload.avatar_url = supabase.storage
            .from("posts")
            .getPublicUrl(fileName).data.publicUrl;
        }
      }

      // Upload Cover
      if (editCoverFile) {
        const fileName = `page_cover_${Date.now()}_${editCoverFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error } = await supabase.storage
          .from("posts")
          .upload(fileName, editCoverFile);
        if (!error) {
          payload.cover_url = supabase.storage
            .from("posts")
            .getPublicUrl(fileName).data.publicUrl;
        }
      }

      const updatedPage = await updatePageInfo(id, payload);
      setPageInfo(updatedPage);
      setSettingsView("menu");
      toast.success("Cập nhật thông tin trang thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi cập nhật trang.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadAdmins = async () => {
    try {
      const admins = await getPageAdmins(id);
      setPageAdmins(admins || []);
      const members = await getPageMembers(id);
      setPageMembers(members || []);
      setSettingsView("admins");
    } catch (err) {
      toast.error("Lỗi tải danh sách quản trị viên.");
    }
  };

  const handleAddAdmin = async (userToAdd: any) => {
    if (pageAdmins.some((admin) => admin.users.id === userToAdd.id)) {
      toast.error(`${userToAdd.name} đã là quản trị viên.`);
      return;
    }
    try {
      await addPageAdmin(id, userToAdd.id);
      setPageAdmins((prev) => [...prev, { role: "admin", users: userToAdd }]);
      setAdminSearchQuery("");
      setAdminSearchResults([]);
      toast.success(`Đã thêm ${userToAdd.name} làm quản trị viên.`);
    } catch (err) {
      toast.error("Lỗi thêm quản trị viên.");
    }
  };

  const handleRemoveAdmin = async (userToRemove: any) => {
    if (userToRemove.id === pageInfo.created_by) {
      toast.error("Không thể xóa người tạo trang.");
      return;
    }
    showConfirm(
      `Bạn có chắc muốn xóa ${userToRemove.name} khỏi vai trò quản trị viên?`,
      async () => {
        try {
          await removePageAdmin(id, userToRemove.id);
          setPageAdmins((prev) =>
            prev.filter((admin) => admin.users.id !== userToRemove.id),
          );
          toast.success(
            `Đã xóa ${userToRemove.name} khỏi vai trò quản trị viên.`,
          );
        } catch (err) {
          toast.error("Lỗi xóa quản trị viên.");
        }
      },
    );
  };

  const handleRemoveMember = async (userToRemove: any) => {
    showConfirm(
      `Bạn có chắc muốn xóa ${userToRemove.name} khỏi danh sách thành viên?`,
      async () => {
        try {
          await removePageMember(id, userToRemove.id);
          setPageMembers((prev) =>
            prev.filter((member) => member.users?.id !== userToRemove.id),
          );
          toast.success(
            `Đã xóa ${userToRemove.name} khỏi danh sách thành viên.`,
          );
        } catch (err) {
          toast.error("Lỗi xóa thành viên.");
        }
      },
    );
  };

  const handleDeletePage = async () => {
    showConfirm(
      "Hành động này không thể hoàn tác! Bạn có chắc chắn muốn xóa vĩnh viễn trang này không?",
      async () => {
        try {
          await deletePage(id);
          toast.success("Đã xóa trang thành công.");
          router.push("/");
        } catch (err) {
          toast.error("Lỗi xóa trang.");
        }
      },
    );
  };

  // ================= FOLLOW HANDLERS =================
  const handleFollow = async (type: "normal" | "favorites") => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để theo dõi trang!");
      return;
    }
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("page_members")
          .update({ follow_type: type })
          .eq("page_id", id)
          .eq("user_id", currentUser.id);
        if (error) {
          if (error.code === "PGRST206") {
            toast.error(
              "Vui lòng thêm cột 'follow_type' vào bảng page_members trên Supabase!",
            );
          } else {
            throw error;
          }
        } else {
          setFollowType(type);
          toast.success(
            type === "favorites"
              ? "Đã chuyển sang Yêu thích!"
              : "Đã chuyển sang Mặc định!",
          );
        }
      } else {
        const { error } = await supabase
          .from("page_members")
          .insert([
            { page_id: id, user_id: currentUser.id, follow_type: type },
          ]);
        if (error) {
          if (error.code === "PGRST206") {
            await supabase
              .from("page_members")
              .insert([{ page_id: id, user_id: currentUser.id }]);
            setIsFollowing(true);
            setMemberCount((prev) => prev + 1);
            toast.success("Đã theo dõi trang!");
            toast.error("Thiếu cột 'follow_type' trên DB để lưu trạng thái.");
          } else {
            throw error;
          }
        } else {
          setIsFollowing(true);
          setFollowType(type);
          setMemberCount((prev) => prev + 1);
          toast.success("Đã theo dõi trang!");
        }
      }
      setShowFollowMenu(false);
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi thực hiện.");
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUser) return;
    setIsFollowLoading(true);
    try {
      const { error } = await supabase
        .from("page_members")
        .delete()
        .eq("page_id", id)
        .eq("user_id", currentUser.id);
      if (error) throw error;
      setIsFollowing(false);
      setFollowType("normal");
      setMemberCount((prev) => Math.max(0, prev - 1));
      toast.success("Đã bỏ theo dõi trang.");
      setShowFollowMenu(false);
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi bỏ theo dõi.");
    } finally {
      setIsFollowLoading(false);
    }
  };

  // ================= CREATE POST HANDLER =================
  const handleCreatePost = async () => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để đăng bài!");
      return;
    }
    if (!postContent && postFiles.length === 0) return;

    setIsPosting(true);
    try {
      let imageUrls: string[] = [];

      if (postFiles.length > 0) {
        for (const f of postFiles) {
          const cleanName = f.name.replace(/[^a-zA-Z0-9.]/g, "_");
          const fileName = `${Date.now()}_${cleanName}`;
          const { error: uploadError } = await supabase.storage
            .from("posts")
            .upload(fileName, f);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage
            .from("posts")
            .getPublicUrl(fileName);
          imageUrls.push(data.publicUrl);
        }
      }

      let is_flagged = false;
      if (postContent) {
        try {
          const modRes = await fetch("/api/moderate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: postContent }),
          });
          const modData = await modRes.json();
          is_flagged = modData.flagged;

          if (is_flagged) {
            toast.error(
              "Nội dung vi phạm tiêu chuẩn cộng đồng và đã bị hệ thống chặn!",
              { duration: 4000 },
            );
          }
        } catch (err) {
          console.error("Lỗi quét AI:", err);
        }
      }

      if (is_flagged) {
        if (imageUrls.length > 0) {
          const uploadedFileNames = imageUrls
            .map((url) => url.split("/").pop()!)
            .filter(Boolean);
          if (uploadedFileNames.length > 0) {
            await supabase.storage.from("posts").remove(uploadedFileNames);
          }
        }
        return;
      }

      const newPost = await createPost({
        content: postContent,
        image_url: imageUrls.length > 0 ? imageUrls[0] : null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        is_flagged,
        page_id: id,
      });

      setPosts((prev) => [newPost, ...prev]);
      setPostContent("");
      setPostFiles([]);
      toast.success("Đăng bài thành công!");
    } catch (error: any) {
      console.error("Lỗi đăng bài:", error);
      toast.error(error.message || "Đăng bài thất bại.");
    } finally {
      setIsPosting(false);
    }
  };

  // ================= FEED INTERACTIONS HANDLERS =================
  const handleLike = async (postId: string, isDoubleClick = false) => {
    if (!currentUser) return;
    if (isDoubleClick) {
      setShowHeartId(postId);
      setTimeout(() => setShowHeartId(null), 1000);
    }

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

    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost((prev: any) => {
        const isLiked = !prev.is_liked;
        return {
          ...prev,
          is_liked: isLiked,
          likes_count: isLiked
            ? (prev.likes_count || 0) + 1
            : Math.max(0, (prev.likes_count || 0) - 1),
        };
      });
    }

    try {
      await toggleLike(postId);
    } catch (error) {
      console.error("Lỗi khi like:", error);
    }
  };

  const handleComment = async (postId: string) => {
    const text = commentInput[postId] || "";
    const file = commentFileMap[postId] || null;
    if (!currentUser || (!text && !file)) return;

    setCommentInput((prev) => ({ ...prev, [postId]: "" }));
    setCommentFileMap((prev) => ({ ...prev, [postId]: null }));

    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      image_url: file ? URL.createObjectURL(file) : null,
      user_id: currentUser.id,
      users: {
        id: currentUser.id,
        name: currentUser.name || currentUser.user_metadata?.name || "Bạn",
        avatar_url:
          currentUser.avatar_url || currentUser.user_metadata?.avatar_url,
      },
    };

    setCommentsMap((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), tempComment],
    }));
    try {
      let imageUrl = null;
      if (file) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `comment_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("comment_images")
          .upload(fileName, file);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("comment_images")
            .getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        }
      }
      const newComment = await createComment(postId, text, imageUrl);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) =>
          c.id === tempId ? newComment : c,
        ),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplyClick = (
    postId: string,
    username: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!username) return;
    const currentText = commentInput[postId] || "";
    const newText = currentText.startsWith(`@${username} `)
      ? currentText
      : `@${username} ${currentText}`;
    setCommentInput((prev) => ({ ...prev, [postId]: newText }));
    setTimeout(() => commentInputRefs.current[postId]?.focus(), 50);
  };

  // ================= MODAL POST HANDLERS =================
  const openPostModal = async (post: any) => {
    setSelectedPost(post);
    const data = await getComments(post.id);
    setModalComments(data || []);
  };

  const closeModal = () => {
    setSelectedPost(null);
    setModalComments([]);
    setModalCommentText("");
    setModalCommentFile(null);
    setShowEmojiPicker(false);
    setOpenPostMenu(false);
    setExpandedReplies({});
  };

  const handleModalComment = async () => {
    const text = modalCommentText;
    const file = modalCommentFile;
    if (!currentUser || (!text.trim() && !file) || !selectedPost) return;
    setModalCommentText("");
    setModalCommentFile(null);

    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      image_url: file ? URL.createObjectURL(file) : null,
      user_id: currentUser.id,
      users: {
        id: currentUser.id,
        name: currentUser.name || currentUser.user_metadata?.name || "Bạn",
        avatar_url:
          currentUser.avatar_url || currentUser.user_metadata?.avatar_url,
      },
    };

    setModalComments((prev) => [...prev, tempComment]);
    setCommentsMap((prev) => ({
      ...prev,
      [selectedPost.id]: [...(prev[selectedPost.id] || []), tempComment],
    }));
    try {
      let imageUrl = null;
      if (file) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `comment_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("comment_images")
          .upload(fileName, file);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("comment_images")
            .getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        }
      }
      const newCmt = await createComment(selectedPost.id, text, imageUrl);
      setModalComments((prev) =>
        prev.map((c) => (c.id === tempId ? newCmt : c)),
      );
      setCommentsMap((prev) => ({
        ...prev,
        [selectedPost.id]: (prev[selectedPost.id] || []).map((c) =>
          c.id === tempId ? newCmt : c,
        ),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleModalReplyClick = (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!username) return;
    const newText = modalCommentText.startsWith(`@${username} `)
      ? modalCommentText
      : `@${username} ${modalCommentText}`;
    setModalCommentText(newText);
    setTimeout(() => modalInputRef.current?.focus(), 50);
  };

  const handleDeleteComment = async (
    commentId: string,
    postId: string,
    isModal = false,
  ) => {
    showConfirm("Bạn có chắc chắn muốn xóa bình luận này?", async () => {
      try {
        await deleteComment(commentId);
        if (isModal)
          setModalComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentsMap((prev) => ({
          ...prev,
          [postId]: prev[postId]?.filter((c) => c.id !== commentId) || [],
        }));
        setOpenCommentMenuId(null);
      } catch (err) {
        toast.error("Xóa bình luận thất bại.");
      }
    });
  };

  const submitEditComment = async (
    commentId: string,
    postId: string,
    isModal = false,
  ) => {
    if (!editCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editCommentText);
      if (isModal)
        setModalComments((prev) =>
          prev.map((c) => (c.id === commentId ? updated : c)),
        );
      setCommentsMap((prev) => ({
        ...prev,
        [postId]:
          prev[postId]?.map((c) => (c.id === commentId ? updated : c)) || [],
      }));
      setEditingCommentId(null);
      setOpenCommentMenuId(null);
    } catch (err) {
      toast.error("Sửa bình luận thất bại.");
    }
  };

  const handleNextImage = (
    e: React.MouseEvent,
    postId: string,
    maxIndex: number,
  ) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => ({
      ...prev,
      [postId]: (prev[postId] || 0) >= maxIndex ? 0 : (prev[postId] || 0) + 1,
    }));
  };

  const handlePrevImage = (
    e: React.MouseEvent,
    postId: string,
    maxIndex: number,
  ) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => ({
      ...prev,
      [postId]: (prev[postId] || 0) <= 0 ? maxIndex : (prev[postId] || 0) - 1,
    }));
  };

  const handleImageClick = (post: any) => {
    if (imageClickTimeout.current) clearTimeout(imageClickTimeout.current);
    imageClickTimeout.current = setTimeout(() => {
      openPostModal(post);
      imageClickTimeout.current = null;
    }, 250);
  };

  const handleImageDoubleClick = (e: React.MouseEvent, post: any) => {
    e.stopPropagation();
    if (imageClickTimeout.current) {
      clearTimeout(imageClickTimeout.current);
      imageClickTimeout.current = null;
    }
    handleLike(post.id, true);
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
        setOpenMenuId(null);
        closeModal();
      } catch (err) {
        toast.error("Xóa bài viết thất bại.");
      }
    });
  };

  const handleSavePost = async (postId: string) => {
    try {
      const { is_saved } = await toggleSavePost(postId);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved } : p)),
      );
      if (selectedPost && selectedPost.id === postId)
        setSelectedPost((prev: any) => ({ ...prev, is_saved }));
      toast.success(
        is_saved ? "Đã lưu bài viết thành công!" : "Đã bỏ lưu bài viết!",
      );
      setOpenMenuId(null);
      setOpenPostMenu(false);
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi lưu bài viết.");
    }
  };

  const handleReportPost = (postId: string) => {
    setReportTargetId(postId);
    setReportType("post");
    setReportReason("");
    setOpenMenuId(null);
    setOpenPostMenu(false);
  };

  const handleReportComment = (commentId: string) => {
    if (!currentUser) return;
    setReportTargetId(commentId);
    setReportType("comment");
    setReportReason("");
    setOpenCommentMenuId(null);
  };

  const submitReport = async () => {
    if (!reportTargetId || !reportReason.trim()) return;
    try {
      if (reportType === "post") {
        await reportPost(reportTargetId, reportReason);
      } else {
        await reportComment(reportTargetId, reportReason);
      }
      toast.success("Đã gửi báo cáo thành công!");
      setReportTargetId(null);
      setReportReason("");
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi báo cáo bài viết.");
    }
  };

  // ================= APPEAL POST HANDLER =================
  const handleSubmitAppeal = async () => {
    if (!appealPostId || !appealReason.trim()) return;
    try {
      await submitAppeal(appealPostId, appealReason);
      toast.success(
        "Đã gửi yêu cầu xem xét lại! Quản trị viên sẽ phản hồi bạn sớm nhất.",
      );
      setAppealPostId(null);
      setAppealReason("");
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi gửi yêu cầu.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 text-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-neutral-900">
        Đang tải thông tin trang...
      </div>
    );
  }

  if (!pageInfo) {
    return (
      <div className="min-h-screen pt-24 text-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-neutral-900">
        Không tìm thấy Trang cộng đồng này!
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900 pb-20">
      {/* Ảnh Bìa (Cover) */}
      <div className="w-full h-[200px] md:h-[300px] bg-gradient-to-r from-blue-400 to-cyan-500 relative group">
        {pageInfo.cover_url && (
          <img
            src={pageInfo.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
            style={{
              objectPosition: `50% ${pageInfo.cover_position_y ?? 50}%`,
            }}
          />
        )}
        <button
          onClick={() => router.push("/")}
          className="absolute top-24 left-4 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-sm transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <main className="max-w-[935px] mx-auto px-4 -mt-16 relative z-10">
        {/* Header Thông tin Fanpage */}
        <div className="bg-white dark:bg-[#262626] rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-neutral-800 flex flex-col md:flex-row items-center md:items-end gap-6 mb-8 text-center md:text-left">
          <img
            src={
              pageInfo.avatar_url ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${pageInfo.id}`
            }
            alt="Avatar"
            className="w-32 h-32 rounded-full border-4 border-white dark:border-[#262626] object-cover bg-white shadow-md"
          />
          <div className="flex-1 pb-2">
            <h1 className="text-2xl font-bold flex items-center justify-center md:justify-start gap-2">
              {pageInfo.name}
              {isAdmin && (
                <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Quản trị viên
                </span>
              )}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm max-w-xl">
              {pageInfo.bio || "Trang này chưa có mô tả."}
            </p>
            <div className="mt-3 flex items-center justify-center md:justify-start gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Users className="w-4 h-4" />
              <span>{memberCount.toLocaleString()} thành viên</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {!isAdmin && currentUser && (
              <div className="relative" ref={followMenuRef}>
                <button
                  onClick={() => {
                    if (!isFollowing) {
                      handleFollow("normal");
                    } else {
                      setShowFollowMenu(!showFollowMenu);
                    }
                  }}
                  disabled={isFollowLoading}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm ${
                    isFollowing
                      ? "bg-gray-200 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-neutral-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {isFollowLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isFollowing ? (
                    followType === "favorites" ? (
                      <Star className="w-5 h-5" />
                    ) : (
                      <UserCheck className="w-5 h-5" />
                    )
                  ) : (
                    <UserPlus className="w-5 h-5" />
                  )}
                  {isFollowing
                    ? followType === "favorites"
                      ? "Yêu thích"
                      : "Đang theo dõi"
                    : "Theo dõi"}
                </button>

                {showFollowMenu && isFollowing && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#333333] border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl dark:shadow-black/50 py-2 z-[100] transition-colors duration-500">
                    <button
                      onClick={() => handleFollow("favorites")}
                      className="w-full text-left px-4 py-3 hover:bg-secondary transition flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Yêu thích</span>
                        {followType === "favorites" && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Bài viết mới sẽ được ưu tiên hiển thị ở trên cùng của
                        bảng tin.
                      </span>
                    </button>
                    <button
                      onClick={() => handleFollow("normal")}
                      className="w-full text-left px-4 py-3 hover:bg-secondary transition flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Mặc định</span>
                        {followType === "normal" && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Bài viết sẽ hiển thị ngẫu nhiên cùng với bạn bè.
                      </span>
                    </button>
                    <div className="border-t border-gray-200 dark:border-neutral-700 my-1"></div>
                    <button
                      onClick={handleUnfollow}
                      className="w-full text-left px-4 py-3 hover:bg-secondary transition flex items-center gap-2 text-red-500 font-semibold text-sm"
                    >
                      <UserMinus className="w-4 h-4" />
                      Bỏ theo dõi
                    </button>
                  </div>
                )}
              </div>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenSettings();
                }}
                className="bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 p-3 rounded-xl transition-all cursor-pointer relative z-[100] shadow-sm flex-shrink-0"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* NỘI DUNG CHÍNH (VERTICAL FEED) */}
        <div className="flex justify-center mt-6 w-full">
          <div className="w-full max-w-[470px] space-y-4">
            {/* ================= CREATE POST FORM ================= */}
            {currentUser &&
              (isAdmin ||
                (isFollowing && pageInfo.post_permission !== "admin_only")) && (
                <div className="shadow-md hover:shadow-lg dark:shadow-black/40 rounded-[12px] p-4 mb-4 border border-gray-200 dark:border-neutral-800 transition-all duration-500 bg-white dark:bg-[#262626]">
                  <div className="flex items-start gap-4">
                    <img
                      src={
                        currentUser.avatar_url ||
                        currentUser.user_metadata?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser.id}`
                      }
                      className="w-10 h-10 rounded-full ring-1 ring-border flex-shrink-0 mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => router.push(`/profile/${currentUser.id}`)}
                      alt="Your avatar"
                    />
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder={`Viết bài lên trang ${pageInfo.name}...`}
                        className="w-full text-base resize-none outline-none min-h-[80px] text-gray-900 dark:text-gray-100 font-semibold bg-transparent pt-1 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        rows={2}
                      />

                      {postFiles.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 mt-2 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          {postFiles.map((f, i) => (
                            <div
                              key={i}
                              className="relative inline-block shrink-0 snap-center"
                            >
                              <img
                                src={URL.createObjectURL(f)}
                                alt="Preview"
                                className="h-32 w-auto rounded-lg object-contain border border-border shadow-sm"
                              />
                              <button
                                onClick={() =>
                                  setPostFiles((prev) =>
                                    prev.filter((_, index) => index !== i),
                                  )
                                }
                                className="absolute -top-2 -right-2 bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-gray-100 rounded-full p-1 shadow-md hover:bg-secondary transition-colors z-10"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1 text-primary text-sm cursor-pointer hover:underline">
                          <ImageIcon size={16} /> Ảnh
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
                          className="bg-blue-500 text-white px-5 py-1.5 rounded-full font-semibold text-sm shadow-sm hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPosting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Đăng"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            <h2 className="text-lg font-bold mb-4">
              Bài viết của trang ({posts.length})
            </h2>

            {posts.length === 0 && (
              <div className="text-center py-20 text-muted-foreground bg-white dark:bg-[#262626] rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                Trang này chưa có bài viết nào.
              </div>
            )}

            {posts.map((post) => (
              <div
                key={post.id}
                className="shadow-md hover:shadow-lg dark:shadow-black/40 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 relative transition-all duration-500 bg-white dark:bg-[#262626]"
                onDoubleClick={() => handleLike(post.id, true)}
              >
                {showHeartId === String(post.id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <Heart className="w-24 h-24 text-white fill-white drop-shadow-[0_0_15px_rgba(0,0,0,0.4)] animate-heart-pop opacity-90" />
                  </div>
                )}

                {/* HEADER */}
                <div className="flex items-center justify-between p-4 pb-2 relative">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        post.pages?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${post.pages?.id}`
                      }
                      className="w-10 h-10 rounded-full ring-1 ring-border object-cover"
                    />
                    <div>
                      <span className="font-semibold text-sm block leading-tight">
                        {post.pages?.name}
                      </span>
                      <span className="text-xs text-muted leading-tight mt-0.5 block">
                        Đăng bởi{" "}
                        <strong
                          onClick={() =>
                            router.push(`/profile/${post.user_id}`)
                          }
                          className="cursor-pointer hover:underline text-gray-900 dark:text-gray-100"
                        >
                          {post.users?.name}
                        </strong>
                        {" • "}
                        {new Date(
                          post.created_at.includes("Z") ||
                            post.created_at.includes("+")
                            ? post.created_at
                            : `${post.created_at}Z`,
                        ).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    {post.is_flagged && (
                      <span className="ml-3 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-sm border border-red-200">
                        Vi phạm
                      </span>
                    )}
                  </div>

                  {/* 3 DOT MENU */}
                  <div
                    className="relative"
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal
                      className="w-5 h-5 cursor-pointer p-1 hover:bg-secondary rounded-full transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(
                          openMenuId === String(post.id)
                            ? null
                            : String(post.id),
                        );
                      }}
                    />
                    {openMenuId === String(post.id) && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 mt-2 w-44 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl dark:shadow-black/50 py-1 z-[100] bg-white dark:bg-[#333333]"
                      >
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSavePost(post.id);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold"
                        >
                          <Bookmark
                            size={18}
                            className={post.is_saved ? "fill-current" : ""}
                          />{" "}
                          {post.is_saved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleReportPost(post.id);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold"
                        >
                          <Flag size={18} /> Báo cáo
                        </button>
                        {(isAdmin || currentUser?.id === post.user_id) && (
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeletePost(post.id);
                            }}
                            className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-500/10 w-full text-sm font-semibold"
                          >
                            <Trash2 size={18} /> Xóa bài viết
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* CONTENT */}
                {(post.content || post.is_flagged) && (
                  <div
                    className={`px-4 pb-3 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 ${post.is_flagged ? "text-red-500 font-semibold italic" : ""}`}
                  >
                    {post.is_flagged
                      ? "Nội dung này đã bị ẩn do vi phạm tiêu chuẩn cộng đồng."
                      : post.content}
                    {post.is_flagged && currentUser?.id === post.user_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAppealPostId(post.id);
                        }}
                        className="block mt-2 text-blue-500 hover:underline text-[12px] font-bold not-italic"
                      >
                        Gửi yêu cầu xem xét lại (Kháng nghị)
                      </button>
                    )}
                  </div>
                )}

                {/* IMAGE */}
                {(post.image_urls?.length > 0 || post.image_url) && (
                  <div
                    className={`relative flex items-stretch justify-between bg-gray-100 dark:bg-[#1a1a1a] w-full overflow-hidden ${post.image_urls?.length > 1 ? "h-[350px] sm:h-[450px] md:h-[550px]" : "min-h-[250px] max-h-[650px]"}`}
                  >
                    {post.image_urls?.length > 1 ? (
                      <div
                        className="w-[12%] md:w-12 shrink-0 flex items-center justify-center z-20 border-r border-gray-200/50 dark:border-neutral-800/50 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        onClick={(e) =>
                          handlePrevImage(
                            e,
                            post.id,
                            post.image_urls.length - 1,
                          )
                        }
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <button className="p-1.5 md:p-2 bg-white/90 hover:bg-white dark:bg-black/60 dark:hover:bg-black/80 rounded-full shadow-md hover:scale-105 transition-transform">
                          <ChevronLeft className="w-5 h-5 text-gray-900 dark:text-gray-100" />
                        </button>
                      </div>
                    ) : null}

                    <div
                      className="flex-1 overflow-hidden flex items-center justify-center relative cursor-pointer"
                      onClick={() => handleImageClick(post)}
                      onDoubleClick={(e) => handleImageDoubleClick(e, post)}
                    >
                      <img
                        src={
                          post.image_urls?.[currentImageIndex[post.id] || 0] ||
                          post.image_url
                        }
                        className={`max-w-full max-h-[650px] w-auto h-auto object-contain transition-all duration-300 select-none pointer-events-none ${post.is_flagged ? "blur-xl scale-110" : ""}`}
                        alt="Post content"
                      />
                    </div>

                    {post.image_urls?.length > 1 ? (
                      <div
                        className="w-[12%] md:w-12 shrink-0 flex items-center justify-center z-20 border-l border-gray-200/50 dark:border-neutral-800/50 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        onClick={(e) =>
                          handleNextImage(
                            e,
                            post.id,
                            post.image_urls.length - 1,
                          )
                        }
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <button className="p-1.5 md:p-2 bg-white/90 hover:bg-white dark:bg-black/60 dark:hover:bg-black/80 rounded-full shadow-md hover:scale-105 transition-transform">
                          <ChevronRight className="w-5 h-5 text-gray-900 dark:text-gray-100" />
                        </button>
                      </div>
                    ) : null}

                    {post.image_urls?.length > 1 && (
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                        {post.image_urls.map((_: any, idx: number) => (
                          <div
                            key={idx}
                            className={`w-2 h-2 rounded-full shadow-sm transition-all duration-300 ${
                              (currentImageIndex[post.id] || 0) === idx
                                ? "bg-blue-500 scale-110"
                                : "bg-white/60 dark:bg-black/60"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    {post.is_flagged && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/30 z-20 pointer-events-none">
                        <Flag className="w-12 h-12 mb-2 text-red-500 drop-shadow-md" />
                        <span className="font-bold text-lg drop-shadow-md">
                          Hình ảnh nhạy cảm
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ACTIONS */}
                <div className="p-3">
                  <div className="flex gap-3 pt-2 pb-1">
                    <Heart
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(post.id);
                      }}
                      className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${(post.is_liked ?? false) ? "text-red-500 fill-red-500" : "stroke-[2px] text-gray-900 dark:text-gray-100"}`}
                    />
                    <MessageCircle
                      onClick={() => openPostModal(post)}
                      className="w-7 h-7 cursor-pointer stroke-[2px]"
                    />
                    <Send
                      className="w-7 h-7 cursor-pointer stroke-[2px] hover:scale-110 transition-transform text-gray-900 dark:text-gray-100 hover:text-blue-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (navigator.share) {
                          navigator
                            .share({
                              title: "InstaMini",
                              text: "Hãy xem bài viết tuyệt vời này trên InstaMini!",
                              url: window.location.origin,
                            })
                            .catch(() => {});
                        } else {
                          navigator.clipboard.writeText(window.location.origin);
                          toast.success("Đã sao chép liên kết!");
                        }
                      }}
                    />
                  </div>
                  <p className="text-sm font-bold mt-1">
                    {post.likes_count || 0} lượt thích
                  </p>

                  {/* COMMENTS SUMMARY */}
                  <div className="mt-2 space-y-1">
                    {commentsMap[post.id]?.length > 1 && (
                      <p
                        className="text-sm text-muted-foreground cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 mb-1"
                        onClick={() => openPostModal(post)}
                      >
                        Xem tất cả {commentsMap[post.id].length} bình luận
                      </p>
                    )}
                    {commentsMap[post.id]
                      ?.slice(0, 1)
                      .map((c: any, idx: number) => {
                        const isReply = c.content?.trim().startsWith("@");
                        return (
                          <div
                            key={c.id ?? idx}
                            className={`flex justify-between items-start group cursor-pointer transition-all ${isReply ? "ml-6 text-[13px] border-l-[2px] border-border/70 pl-2 mt-1" : "text-sm mt-2"}`}
                            onDoubleClick={(e) =>
                              handleReplyClick(post.id, c?.users?.name, e)
                            }
                          >
                            <div className="flex-1">
                              <span className="font-bold mr-1">
                                {c?.users?.name || "user"}:
                              </span>
                              {editingCommentId === c.id ? (
                                <div className="flex flex-col gap-1 mt-1">
                                  <input
                                    className="border px-2 py-1 rounded w-full outline-none text-sm bg-transparent"
                                    value={editCommentText}
                                    onChange={(e) =>
                                      setEditCommentText(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        submitEditComment(c.id, post.id);
                                      if (e.key === "Escape")
                                        setEditingCommentId(null);
                                    }}
                                    autoFocus
                                  />
                                  <div className="flex gap-2 text-xs">
                                    <button
                                      onClick={() =>
                                        submitEditComment(c.id, post.id)
                                      }
                                      className="text-blue-500 font-semibold"
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      onClick={() => setEditingCommentId(null)}
                                      className="text-muted-foreground"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span>{c.content}</span>
                                  {c.image_url && (
                                    <img
                                      src={c.image_url}
                                      alt="comment-img"
                                      className="mt-1 max-h-32 rounded-lg object-contain border border-gray-200 dark:border-neutral-700"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                            {currentUser && !editingCommentId && (
                              <div className="relative opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <MoreHorizontal
                                  className="w-4 h-4 cursor-pointer text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenCommentMenuId(
                                      openCommentMenuId === c.id ? null : c.id,
                                    );
                                  }}
                                />
                                {openCommentMenuId === c.id && (
                                  <div className="absolute right-0 mt-1 w-24 border border-gray-200 dark:border-neutral-700 shadow-lg rounded-lg py-1 z-50 bg-white dark:bg-[#333333]">
                                    {currentUser.id === c.user_id || isAdmin ? (
                                      <>
                                        {currentUser.id === c.user_id && (
                                          <button
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setEditingCommentId(c.id);
                                              setEditCommentText(c.content);
                                              setOpenCommentMenuId(null);
                                            }}
                                            className="w-full text-left px-3 py-1 text-sm hover:bg-secondary"
                                          >
                                            Sửa
                                          </button>
                                        )}
                                        <button
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDeleteComment(c.id, post.id);
                                          }}
                                          className="w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-secondary"
                                        >
                                          Xóa
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleReportComment(c.id);
                                        }}
                                        className="w-full text-left px-3 py-1 text-sm hover:bg-secondary flex items-center gap-2"
                                      >
                                        <Flag size={14} /> Báo cáo
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* COMMENT INPUT */}
                  <div className="flex items-center gap-3 pt-3 mt-2 border-t border-border">
                    <img
                      src={
                        currentUser?.avatar_url ||
                        currentUser?.user_metadata?.avatar_url ||
                        (currentUser
                          ? `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser.id}`
                          : "/sukhoi.jpg")
                      }
                      className="w-7 h-7 rounded-full flex-shrink-0 object-cover"
                    />
                    <input
                      ref={(el) => {
                        commentInputRefs.current[post.id] = el;
                      }}
                      value={commentInput[post.id] ?? ""}
                      onChange={(e) =>
                        setCommentInput((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400"
                      placeholder="Thêm bình luận..."
                    />
                    {commentFileMap[post.id] && (
                      <div className="relative">
                        <img
                          src={URL.createObjectURL(commentFileMap[post.id]!)}
                          className="h-8 w-8 object-cover rounded border border-gray-200 dark:border-neutral-700"
                        />
                        <button
                          onClick={() =>
                            setCommentFileMap((prev) => ({
                              ...prev,
                              [post.id]: null,
                            }))
                          }
                          className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                    <label className="cursor-pointer text-gray-500 hover:text-blue-500 p-1">
                      <ImageIcon size={18} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          setCommentFileMap((prev) => ({
                            ...prev,
                            [post.id]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                    </label>
                    {(commentInput[post.id] || commentFileMap[post.id]) && (
                      <button
                        onClick={() => handleComment(post.id)}
                        className="text-primary font-semibold text-sm"
                      >
                        Đăng
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ================= MODAL POST DETAIL ================= */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#262626]/95 p-4 md:p-10 cursor-pointer transition-all"
          onClick={closeModal}
        >
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-[10000] p-2"
          >
            <X className="w-8 h-8" />
          </button>
          <div
            className={`text-gray-900 dark:text-gray-100 flex flex-col md:flex-row w-full ${selectedPost.image_url ? "max-w-5xl" : "max-w-xl"} max-h-[90vh] rounded-xl overflow-hidden shadow-2xl dark:shadow-black/60 relative animate-in fade-in zoom-in-95 duration-200 cursor-default bg-white dark:bg-[#262626]`}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedPost.image_url && (
              <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center min-h-[300px] md:min-h-[500px]">
                <img
                  src={selectedPost.image_url}
                  className="w-full h-full object-cover object-center"
                  alt="Post content"
                />
              </div>
            )}
            <div
              className={`w-full flex flex-col h-[50vh] md:h-auto bg-white dark:bg-[#262626] ${selectedPost.image_url ? "md:w-[400px] border-l border-gray-200 dark:border-neutral-800" : "md:min-h-[500px]"}`}
            >
              <div className="flex flex-col border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333]">
                <div className="flex items-center justify-between p-4 pb-2 relative">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        selectedPost.pages?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedPost.pages?.id}`
                      }
                      className="w-10 h-10 rounded-full border object-cover"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">
                        {selectedPost.pages?.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Đăng bởi{" "}
                        <strong className="text-gray-900 dark:text-gray-100">
                          {selectedPost.users?.name}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <MoreHorizontal
                      className="w-5 h-5 cursor-pointer text-gray-900 dark:text-gray-100 hover:text-gray-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPostMenu(!openPostMenu);
                      }}
                    />
                    {openPostMenu && (
                      <div className="absolute right-0 mt-2 w-44 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl dark:shadow-black/50 py-1 z-[100] bg-white dark:bg-[#333333]">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSavePost(selectedPost.id);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold"
                        >
                          <Bookmark
                            size={18}
                            className={
                              selectedPost.is_saved ? "fill-current" : ""
                            }
                          />{" "}
                          {selectedPost.is_saved
                            ? "Bỏ lưu bài viết"
                            : "Lưu bài viết"}
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleReportPost(selectedPost.id);
                            setOpenPostMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold"
                        >
                          <Flag size={18} /> Báo cáo
                        </button>
                        {(isAdmin ||
                          currentUser?.id === selectedPost.user_id) && (
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeletePost(selectedPost.id);
                              closeModal();
                            }}
                            className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-500/10 w-full text-sm font-semibold"
                          >
                            <Trash2 size={18} /> Xóa bài viết
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {selectedPost.content && (
                  <div className="px-4 pb-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {selectedPost.content}
                  </div>
                )}
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {(() => {
                  const items: any[] = [];
                  let tempReplies: any[] = [];
                  modalComments.forEach((c: any) => {
                    const isReply = c.content?.trim().startsWith("@");
                    if (isReply) {
                      tempReplies.push(c);
                    } else {
                      if (tempReplies.length > 0) {
                        items.push({ type: "replies", data: tempReplies });
                        tempReplies = [];
                      }
                      items.push({ type: "comment", data: c });
                    }
                  });
                  if (tempReplies.length > 0) {
                    items.push({ type: "replies", data: tempReplies });
                  }

                  const renderComment = (c: any, isReply: boolean) => (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 group relative cursor-pointer ${isReply ? "ml-10 mt-1" : "mt-4"}`}
                      onDoubleClick={(e) =>
                        handleModalReplyClick(c.users?.name, e)
                      }
                    >
                      <img
                        src={
                          c.users?.avatar_url ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`
                        }
                        className={`${isReply ? "w-7 h-7" : "w-10 h-10"} rounded-full border object-cover flex-shrink-0`}
                      />
                      <div className={`${isReply ? "mt-0" : "mt-1"} flex-1`}>
                        <span
                          className={`font-semibold mr-2 ${isReply ? "text-xs" : "text-sm"}`}
                        >
                          {c.users?.name || "Người dùng"}
                        </span>
                        {editingCommentId === c.id ? (
                          <div className="flex flex-col gap-1 mt-1">
                            <input
                              className="border px-2 py-1 rounded-lg w-full outline-none text-sm bg-transparent"
                              value={editCommentText}
                              onChange={(e) =>
                                setEditCommentText(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  submitEditComment(
                                    c.id,
                                    selectedPost.id,
                                    true,
                                  );
                                if (e.key === "Escape")
                                  setEditingCommentId(null);
                              }}
                              autoFocus
                            />
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() =>
                                  submitEditComment(c.id, selectedPost.id, true)
                                }
                                className="text-blue-500 font-semibold"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={() => setEditingCommentId(null)}
                                className="text-muted-foreground"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span
                            className={`whitespace-pre-wrap ${isReply ? "text-[13px] text-muted-foreground" : "text-sm"}`}
                          >
                            {c.content}
                          </span>
                        )}
                      </div>
                      {currentUser && !editingCommentId && (
                        <div className="relative opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2 mt-1">
                          <MoreHorizontal
                            className="w-4 h-4 cursor-pointer text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCommentMenuId(
                                openCommentMenuId === c.id ? null : c.id,
                              );
                            }}
                          />
                          {openCommentMenuId === c.id && (
                            <div className="absolute right-0 mt-1 w-24 border border-gray-200 dark:border-neutral-700 shadow-lg rounded-lg py-1 z-50 bg-white dark:bg-[#333333]">
                              {currentUser.id === c.user_id || isAdmin ? (
                                <>
                                  {currentUser.id === c.user_id && (
                                    <button
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setEditingCommentId(c.id);
                                        setEditCommentText(c.content);
                                        setOpenCommentMenuId(null);
                                      }}
                                      className="w-full text-left px-3 py-1 text-sm hover:bg-secondary"
                                    >
                                      Sửa
                                    </button>
                                  )}
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteComment(
                                        c.id,
                                        selectedPost.id,
                                        true,
                                      );
                                    }}
                                    className="w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-secondary"
                                  >
                                    Xóa
                                  </button>
                                </>
                              ) : (
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleReportComment(c.id);
                                  }}
                                  className="w-full text-left px-3 py-1 text-sm hover:bg-secondary flex items-center gap-2"
                                >
                                  <Flag size={14} /> Báo cáo
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );

                  return items.map((item, idx) => {
                    if (item.type === "comment") {
                      return renderComment(item.data, false);
                    } else {
                      const replies = item.data;
                      if (replies.length === 1) {
                        return renderComment(replies[0], true);
                      } else {
                        const groupId = replies[0].id;
                        const isExpanded = expandedReplies[groupId];
                        return (
                          <div key={`group-${groupId}`} className="space-y-4">
                            {!isExpanded ? (
                              <div
                                className="ml-10 mt-1 flex items-center gap-3 cursor-pointer group"
                                onClick={() =>
                                  setExpandedReplies((prev) => ({
                                    ...prev,
                                    [groupId]: true,
                                  }))
                                }
                              >
                                <div className="w-8 h-[1px] bg-gray-400 dark:bg-gray-600"></div>
                                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                                  Xem {replies.length} câu trả lời từ{" "}
                                  {replies[0].users?.name || "Người dùng"}
                                </span>
                              </div>
                            ) : (
                              replies.map((c: any) => renderComment(c, true))
                            )}
                          </div>
                        );
                      }
                    }
                  });
                })()}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <Heart
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(selectedPost.id);
                    }}
                    className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${(selectedPost.is_liked ?? false) ? "text-red-500 fill-red-500" : "stroke-[2px] text-gray-900 dark:text-gray-100"}`}
                  />
                  <span className="font-semibold text-sm">
                    {selectedPost.likes_count || 0} lượt thích
                  </span>
                </div>
                <div
                  ref={emojiPickerRef}
                  className="flex items-center gap-2 mt-3 border border-gray-200 dark:border-neutral-700 shadow-inner rounded-full px-3 py-1 bg-gray-50 dark:bg-[#333333] focus-within:bg-white dark:focus-within:bg-[#262626] relative"
                >
                  <Smile
                    className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  />
                  {showEmojiPicker && (
                    <div className="absolute bottom-12 left-0 bg-white dark:bg-[#333333] border border-gray-200 dark:border-neutral-700 shadow-xl rounded-xl p-3 w-64 z-[99999]">
                      <div className="grid grid-cols-5 gap-3 text-xl">
                        {[
                          "😀",
                          "😂",
                          "😍",
                          "🥰",
                          "😊",
                          "😎",
                          "😢",
                          "😭",
                          "😡",
                          "👍",
                          "❤️",
                          "🔥",
                          "✨",
                          "🎉",
                          "🙌",
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            className="hover:scale-125 transition-transform"
                            onClick={() =>
                              setModalCommentText((prev) => prev + emoji)
                            }
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <input
                    ref={modalInputRef}
                    className="flex-1 px-2 py-1.5 text-sm outline-none bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
                    value={modalCommentText}
                    onChange={(e) => setModalCommentText(e.target.value)}
                    placeholder="Thêm bình luận..."
                    onKeyDown={(e) => e.key === "Enter" && handleModalComment()}
                  />
                  {modalCommentFile && (
                    <div className="relative">
                      <img
                        src={URL.createObjectURL(modalCommentFile)}
                        className="h-8 w-8 object-cover rounded border border-gray-200 dark:border-neutral-700"
                      />
                      <button
                        onClick={() => setModalCommentFile(null)}
                        className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer text-gray-500 hover:text-blue-500 p-1">
                    <ImageIcon size={18} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        setModalCommentFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                  <button
                    onClick={handleModalComment}
                    disabled={!modalCommentText.trim() && !modalCommentFile}
                    className="text-blue-500 font-semibold text-sm disabled:opacity-50 px-2"
                  >
                    Đăng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL REPORT ================= */}
      {reportTargetId && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setReportTargetId(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold">
                Báo cáo {reportType === "post" ? "bài viết" : "bình luận"}
              </h3>
              <button onClick={() => setReportTargetId(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Vui lòng nhập lý do báo cáo{" "}
                {reportType === "post" ? "bài viết" : "bình luận"} này. Quản trị
                viên sẽ xem xét báo cáo của bạn.
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Ví dụ: Nội dung phản cảm, spam..."
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none resize-none bg-gray-50 dark:bg-[#333333] text-sm text-gray-900 dark:text-gray-100"
                rows={4}
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] rounded-lg"
                onClick={() => setReportTargetId(null)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
                onClick={submitReport}
                disabled={!reportReason.trim()}
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL APPEAL POST ================= */}
      {appealPostId && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setAppealPostId(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Gửi yêu cầu xem xét lại
              </h3>
              <button
                onClick={() => setAppealPostId(null)}
                className="hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Vui lòng nhập lý do bạn cho rằng bài viết này không vi phạm tiêu
                chuẩn cộng đồng.
              </p>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Ví dụ: Hình ảnh này chỉ là ảnh nghệ thuật, không có yếu tố phản cảm..."
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors resize-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] text-sm text-gray-900 dark:text-gray-100"
                rows={4}
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors rounded-lg"
                onClick={() => setAppealPostId(null)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors rounded-lg disabled:opacity-50"
                onClick={handleSubmitAppeal}
                disabled={!appealReason.trim()}
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL SETTINGS FANPAGE ================= */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 border border-gray-200 dark:border-neutral-800 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-neutral-800 shrink-0 bg-gray-50 dark:bg-[#333333]">
              <div className="flex items-center gap-2">
                {settingsView !== "menu" && (
                  <button
                    onClick={() => setSettingsView("menu")}
                    className="hover:bg-gray-200 dark:hover:bg-neutral-700 p-1 rounded-full"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="font-bold text-lg">
                  {settingsView === "menu"
                    ? "Cài đặt Trang"
                    : settingsView === "edit"
                      ? "Sửa thông tin"
                      : "Quản trị viên"}
                </h2>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="hover:bg-gray-200 dark:hover:bg-neutral-700 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {settingsView === "menu" && (
                <div className="space-y-3">
                  <div className="flex flex-col items-center justify-center py-4 mb-2">
                    <img
                      src={
                        pageInfo.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${pageInfo.id}`
                      }
                      className="w-20 h-20 rounded-full border-4 border-white dark:border-[#262626] shadow-md object-cover mb-3"
                    />
                    <h3 className="font-bold text-xl">{pageInfo.name}</h3>
                  </div>
                  <button
                    onClick={() => setSettingsView("edit")}
                    className="w-full flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-[#3f3f3f] rounded-xl transition font-semibold border border-gray-200 dark:border-neutral-800 shadow-sm"
                  >
                    <Edit3 className="w-5 h-5 text-blue-500" /> Chỉnh sửa thông
                    tin Trang
                  </button>
                  <button
                    onClick={handleLoadAdmins}
                    className="w-full flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-[#3f3f3f] rounded-xl transition font-semibold border border-gray-200 dark:border-neutral-800 shadow-sm"
                  >
                    <Users className="w-5 h-5 text-green-500" /> Quản lý quản
                    trị viên
                  </button>
                  <button
                    onClick={handleDeletePage}
                    className="w-full flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 rounded-xl transition font-semibold border border-red-100 dark:border-red-900/30 shadow-sm mt-8"
                  >
                    <Trash2 className="w-5 h-5" /> Xóa vĩnh viễn trang
                  </button>
                </div>
              )}

              {settingsView === "edit" && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-24 h-24 rounded-full border-2 border-gray-200 dark:border-neutral-700 bg-gray-100 dark:bg-[#333333] flex items-center justify-center overflow-hidden shadow-sm">
                      {editAvatarFile || pageInfo?.avatar_url ? (
                        <img
                          src={
                            editAvatarFile
                              ? URL.createObjectURL(editAvatarFile)
                              : pageInfo.avatar_url
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-8 h-8 text-gray-400" />
                      )}
                      <label className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center text-white opacity-0 hover:opacity-100">
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
                    <span className="text-xs font-semibold text-blue-500 cursor-pointer">
                      Đổi ảnh đại diện
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold">Tên Trang</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none bg-gray-50 dark:bg-[#333333]"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold">Mô tả (Bio)</label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none resize-none bg-gray-50 dark:bg-[#333333]"
                      rows={3}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold">
                      Quyền đăng bài
                    </label>
                    <select
                      value={editPostPermission}
                      onChange={(e) =>
                        setEditPostPermission(
                          e.target.value as "admin_only" | "anyone",
                        )
                      }
                      className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none bg-gray-50 dark:bg-[#333333]"
                    >
                      <option value="anyone">
                        Quản trị viên và Thành viên
                      </option>
                      <option value="admin_only">Chỉ Quản trị viên</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold mb-1">
                      Ảnh bìa hiện tại
                    </label>
                    <div
                      className="relative w-full h-32 bg-gray-100 dark:bg-[#333333] rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700 cursor-grab active:cursor-grabbing touch-none"
                      onMouseDown={(e) => handleDragStart(e.clientY)}
                      onMouseMove={(e) => handleDragMove(e.clientY)}
                      onMouseUp={handleDragEnd}
                      onMouseLeave={handleDragEnd}
                      onTouchStart={(e) =>
                        handleDragStart(e.touches[0].clientY)
                      }
                      onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
                      onTouchEnd={handleDragEnd}
                    >
                      {(editCoverFile || pageInfo?.cover_url) && (
                        <img
                          src={
                            editCoverFile
                              ? URL.createObjectURL(editCoverFile)
                              : pageInfo.cover_url
                          }
                          className="w-full h-full object-cover pointer-events-none select-none"
                          style={{
                            objectPosition: `50% ${editCoverPositionY}%`,
                          }}
                        />
                      )}
                      <label
                        className="absolute top-2 right-2 cursor-pointer bg-black/50 hover:bg-black/70 transition-colors flex items-center justify-center text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm z-10"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                      >
                        <Camera size={14} className="mr-1.5" />
                        Đổi ảnh bìa
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            setEditCoverFile(e.target.files?.[0] || null)
                          }
                        />
                      </label>
                      {(editCoverFile || pageInfo?.cover_url) && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors opacity-0 hover:opacity-100">
                          <span className="text-white bg-black/50 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm">
                            Kéo lên/xuống để căn chỉnh
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleUpdatePage}
                    disabled={isSaving || !editName.trim()}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-sm transition-colors mt-2"
                  >
                    {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              )}

              {settingsView === "admins" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border border-gray-200 dark:border-neutral-700 shadow-inner bg-gray-50 dark:bg-[#333333] p-2 rounded-xl">
                    <Search size={18} className="text-muted-foreground ml-1" />
                    <input
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      placeholder="Tìm người dùng để thêm..."
                      className="flex-1 outline-none text-[15px] bg-transparent"
                    />
                  </div>

                  {adminSearchResults.length > 0 && (
                    <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-neutral-800">
                      {adminSearchResults.map((u) => (
                        <div
                          key={u.id}
                          className="flex justify-between items-center p-3"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                u.avatar_url ||
                                `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                              }
                              className="w-8 h-8 rounded-full border"
                            />
                            <span className="font-semibold text-sm">
                              {u.name}
                            </span>
                          </div>
                          <button
                            onClick={() => handleAddAdmin(u)}
                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                          >
                            Thêm
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mt-4">
                    Danh sách quản trị viên ({pageAdmins.length})
                  </h3>
                  <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-neutral-800">
                    {pageAdmins.map((admin) => (
                      <div
                        key={admin.users.id}
                        className="flex justify-between items-center p-3"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              admin.users.avatar_url ||
                              `https://api.dicebear.com/7.x/identicon/svg?seed=${admin.users.id}`
                            }
                            className="w-10 h-10 rounded-full object-cover border"
                          />
                          <div>
                            <span className="font-bold text-sm block">
                              {admin.users.name}{" "}
                              {admin.users.id === currentUser?.id
                                ? "(Bạn)"
                                : ""}
                            </span>
                            <span className="text-xs text-blue-500 font-semibold">
                              {admin.users.id === pageInfo.created_by
                                ? "Người tạo trang"
                                : "Quản trị viên"}
                            </span>
                          </div>
                        </div>
                        {admin.users.id !== pageInfo.created_by && (
                          <button
                            onClick={() => handleRemoveAdmin(admin.users)}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mt-6">
                    Danh sách thành viên ({pageMembers.length})
                  </h3>
                  <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-neutral-800">
                    {pageMembers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Trang chưa có thành viên nào.
                      </div>
                    ) : (
                      pageMembers.map((member) => (
                        <div
                          key={member.users?.id}
                          className="flex justify-between items-center p-3"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                member.users?.avatar_url ||
                                `https://api.dicebear.com/7.x/identicon/svg?seed=${member.users?.id}`
                              }
                              className="w-10 h-10 rounded-full object-cover border"
                            />
                            <div>
                              <span className="font-bold text-sm block">
                                {member.users?.name}
                              </span>
                              <span className="text-xs text-muted-foreground font-semibold">
                                Thành viên
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMember(member.users)}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes heart-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          15% {
            transform: scale(1.2);
            opacity: 1;
          }
          30% {
            transform: scale(1);
            opacity: 1;
          }
          80% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .animate-heart-pop {
          animation: heart-pop 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
