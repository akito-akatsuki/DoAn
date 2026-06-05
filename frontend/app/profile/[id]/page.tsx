"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import {
  Heart,
  MoreHorizontal,
  X,
  Trash2,
  Smile,
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Flag,
  Maximize,
  Briefcase,
  MapPin,
  ZoomIn,
  ZoomOut,
  Bookmark,
  Pencil,
  Send,
  Link as LinkIcon,
  Share,
} from "lucide-react";
import { useRef } from "react";
import {
  getComments,
  createComment,
  deleteComment,
  updateComment,
  toggleLike,
  reportPost,
  reportComment,
  toggleSavePost,
} from "@/lib/api";
import { showConfirm } from "@/components/GlobalConfirm";
import { useRouter } from "next/navigation";

type UserProfile = {
  id: string;
  name: string;
  avatar_url?: string | null;
  bio?: string | null;
  cover_url?: string | null;
  cover_position_y?: number | null;
  dob?: string | null;
  address?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  hobbies?: string | null;
  work?: string | null;
  phone?: string | null;
};

const PROVINCES = [
  "An Giang",
  "Bà Rịa - Vũng Tàu",
  "Bắc Giang",
  "Bắc Kạn",
  "Bạc Liêu",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Định",
  "Bình Dương",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cần Thơ",
  "Cao Bằng",
  "Đà Nẵng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Nội",
  "Hà Tĩnh",
  "Hải Dương",
  "Hải Phòng",
  "Hậu Giang",
  "Hòa Bình",
  "Hưng Yên",
  "Khánh Hòa",
  "Kiên Giang",
  "Kon Tum",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Long An",
  "Nam Định",
  "Nghệ An",
  "Ninh Bình",
  "Ninh Thuận",
  "Phú Thọ",
  "Phú Yên",
  "Quảng Bình",
  "Quảng Nam",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sóc Trăng",
  "Sơn La",
  "Tây Ninh",
  "Thái Bình",
  "Thái Nguyên",
  "Thanh Hóa",
  "Thừa Thiên Huế",
  "Tiền Giang",
  "TP. Hồ Chí Minh",
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Yên Bái",
];

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ Next 16 fix params
  const { id } = use(params);

  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // ================= FOLLOW STATS & MODALS =================
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);

  // ================= MODAL STATES =================
  const modalInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const addressRef = useRef<HTMLDivElement | null>(null);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [modalCommentText, setModalCommentText] = useState("");
  const [modalCommentFile, setModalCommentFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [openPostMenu, setOpenPostMenu] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});

  // ================= REPORT =================
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"post" | "comment">("post");
  const [reportReason, setReportReason] = useState("");

  // ================= SHARE POST =================
  const [sharePost, setSharePost] = useState<any | null>(null);
  const [shareFriends, setShareFriends] = useState<any[]>([]);
  const [isSharing, setIsSharing] = useState(false);

  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);

  // ================= EDIT PROFILE STATES =================
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editMaritalStatus, setEditMaritalStatus] = useState("");
  const [editHobbies, setEditHobbies] = useState("");
  const [editWork, setEditWork] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCover, setEditCover] = useState<File | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<
    Record<string, number>
  >({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [editCoverPositionY, setEditCoverPositionY] = useState(50);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);

  // ================= CLICK OUTSIDE =================
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
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
        addressRef.current &&
        !addressRef.current.contains(e.target as Node)
      ) {
        setShowAddressDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // ================= LOAD SHARE FRIENDS =================
  useEffect(() => {
    if (sharePost && currentUser?.id) {
      const fetchFriends = async () => {
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id);
        if (follows && follows.length > 0) {
          const ids = follows.map((f: any) => f.following_id);
          const { data: users } = await supabase
            .from("users")
            .select("id, name, avatar_url")
            .in("id", ids)
            .limit(10);
          setShareFriends(users || []);
        } else {
          setShareFriends([]);
        }
      };
      fetchFriends();
    }
  }, [sharePost, currentUser?.id]);

  const handleSendToFriend = async (friendId: string) => {
    if (!currentUser || isSharing) return;
    setIsSharing(true);
    try {
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", currentUser.id);
      let convId = null;
      if (myParts && myParts.length > 0) {
        const convIds = myParts.map((p) => p.conversation_id);
        const { data: friendParts } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", friendId)
          .in("conversation_id", convIds);

        if (friendParts && friendParts.length > 0) {
          const commonConvIds = friendParts.map((p) => p.conversation_id);
          const { data: convs } = await supabase
            .from("conversations")
            .select("id")
            .in("id", commonConvIds)
            .eq("is_group", false)
            .limit(1);
          if (convs && convs.length > 0) convId = convs[0].id;
        }
      }

      if (!convId) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ is_group: false })
          .select("id")
          .single();
        if (newConv) {
          convId = newConv.id;
          await supabase.from("conversation_participants").insert([
            { conversation_id: convId, user_id: currentUser.id },
            { conversation_id: convId, user_id: friendId },
          ]);
        }
      }

      if (convId) {
        const postUrl = `${window.location.origin}/post/${sharePost.id}`;
        await supabase.from("messages").insert({
          conversation_id: convId,
          sender_id: currentUser.id,
          content: `Hãy xem bài viết này: ${postUrl}`,
        });
        await supabase
          .from("conversations")
          .update({ last_message: `Hãy xem bài viết này...` })
          .eq("id", convId);
        toast.success("Đã gửi cho bạn bè!");
        setSharePost(null);
        router.push("/messages");
      }
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi gửi");
    } finally {
      setIsSharing(false);
    }
  };

  // ================= LOAD CURRENT USER =================
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error && error.message.includes("Refresh Token Not Found")) {
        await supabase.auth.signOut();
      }
      if (data.user) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", data.user.id)
          .single();

        setCurrentUser({ ...data.user, ...(dbUser || {}) });
      }
    };

    loadUser();
  }, []);

  // ================= LOAD PROFILE + POSTS =================
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

      setProfile(user);

      const { data: postsData } = await supabase
        .from("posts")
        .select("id, content, image_url, image_urls, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

      setPosts(postsData || []);

      // Lấy số lượng người theo dõi
      const { count: followers } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", id);
      setFollowersCount(followers || 0);

      // Lấy số lượng đang theo dõi
      const { count: following } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", id);
      setFollowingCount(following || 0);

      setLoading(false);
    };

    load();
  }, [id]);

  // ================= CHECK FOLLOW =================
  useEffect(() => {
    const checkFollow = async () => {
      if (!currentUser || !id) return;

      const { data } = await supabase
        .from("follows")
        .select("*")
        .eq("follower_id", currentUser.id)
        .eq("following_id", id)
        .maybeSingle();

      setIsFollowing(!!data);
    };

    checkFollow();
  }, [currentUser, id]);

  // ================= TOGGLE FOLLOW =================
  const toggleFollow = async () => {
    if (!currentUser || currentUser.id === id) return;

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", id);

      setIsFollowing(false);
      setFollowersCount((prev) => Math.max(0, prev - 1));
    } else {
      await supabase.from("follows").insert({
        follower_id: currentUser.id,
        following_id: id,
      });

      setIsFollowing(true);
      setFollowersCount((prev) => prev + 1);
    }
  };

  // ================= LOAD FOLLOW LISTS =================
  const loadFollowers = async () => {
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", id);
    if (data && data.length > 0) {
      const ids = data.map((d) => d.follower_id);
      const { data: users } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .in("id", ids);
      setFollowersList(users || []);
    } else {
      setFollowersList([]);
    }
    setShowFollowersModal(true);
  };

  const loadFollowing = async () => {
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", id);
    if (data && data.length > 0) {
      const ids = data.map((d) => d.following_id);
      const { data: users } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .in("id", ids);
      setFollowingList(users || []);
    } else {
      setFollowingList([]);
    }
    setShowFollowingModal(true);
  };

  // ================= POST MODAL HANDLERS =================
  const openPostModal = async (post: any) => {
    setSelectedPost({
      ...post,
      users: profile,
      likes_count: 0,
      is_liked: false,
      is_saved: false,
    });

    const { data: fullPost } = await supabase
      .from("posts")
      .select("*, users:user_id (id, name, avatar_url)")
      .eq("id", post.id)
      .single();

    const { count: likeCount } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);

    let isLiked = false;
    let isSaved = false;
    if (currentUser) {
      const { data: likeData } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();
      isLiked = !!likeData;

      const { data: saveData } = await supabase
        .from("saved_posts")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();
      isSaved = !!saveData;
    }

    setSelectedPost({
      ...fullPost,
      likes_count: likeCount || 0,
      is_liked: isLiked,
      is_saved: isSaved,
    });

    const data = await getComments(post.id);
    setModalComments(data || []);
  };

  const closeModal = () => {
    setSelectedPost(null);
    setModalComments([]);
    setModalCommentText("");
    setOpenCommentMenuId(null);
    setShowEmojiPicker(false);
    setExpandedReplies({});
  };

  const handleLike = async (postId: string) => {
    if (!currentUser || !selectedPost) return;
    const currentlyLiked = selectedPost.is_liked;
    setSelectedPost((prev: any) => ({
      ...prev,
      is_liked: !currentlyLiked,
      likes_count: !currentlyLiked
        ? (prev.likes_count || 0) + 1
        : Math.max(0, (prev.likes_count || 0) - 1),
    }));
    try {
      const res = await toggleLike(postId);
      setSelectedPost((prev: any) => ({
        ...prev,
        is_liked: res.is_liked,
        likes_count:
          (res as any).likes !== undefined
            ? (res as any).likes
            : res.likes_count,
      }));
    } catch (error) {
      console.error(error);
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

  const handleModalComment = async () => {
    if (!currentUser || !modalCommentText.trim() || !selectedPost) return;
    const text = modalCommentText;
    setModalCommentText("");
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      user_id: currentUser.id,
      users: {
        id: currentUser.id,
        name:
          currentUser.name ||
          currentUser.user_metadata?.name ||
          currentUser.user_metadata?.full_name ||
          "Bạn",
        avatar_url:
          currentUser.avatar_url || currentUser.user_metadata?.avatar_url,
      },
    };
    setModalComments((prev) => [...prev, tempComment]);
    try {
      const newCmt = await createComment(selectedPost.id, text);
      setModalComments((prev) =>
        prev.map((c) => (c.id === tempId ? newCmt : c)),
      );
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

  const handleDeleteComment = async (commentId: string) => {
    showConfirm("Bạn có chắc chắn muốn xóa bình luận này?", async () => {
      try {
        await deleteComment(commentId);
        setModalComments((prev) => prev.filter((c) => c.id !== commentId));
        setOpenCommentMenuId(null);
      } catch (err) {
        console.error(err);
        toast.error("Xóa bình luận thất bại.");
      }
    });
  };

  const handleReportPost = (postId: string) => {
    setReportTargetId(postId);
    setReportType("post");
    setReportReason("");
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
      console.error("LỖI BÁO CÁO BÀI VIẾT:", err);
      toast.error("Đã xảy ra lỗi khi báo cáo bài viết.");
    }
  };

  const submitEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editCommentText);
      setModalComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c)),
      );
      setEditingCommentId(null);
      setOpenCommentMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= DELETE POST =================
  const handleDeletePost = async (postId: string) => {
    showConfirm("Bạn có chắc chắn muốn xóa bài viết này?", async () => {
      try {
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", postId);
        if (error) throw error;

        setPosts((prev) => prev.filter((p) => p.id !== postId));
        closeModal();
      } catch (err) {
        console.error("LỖI XÓA BÀI:", err);
        toast.error("Xóa bài viết thất bại.");
      }
    });
  };

  // ================= SAVE POST =================
  const handleSavePost = async (postId: string) => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập!");
      return;
    }
    try {
      const { is_saved } = await toggleSavePost(postId);
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost((prev: any) => ({ ...prev, is_saved }));
      }
      toast.success(
        is_saved ? "Đã lưu bài viết thành công!" : "Đã bỏ lưu bài viết!",
      );
      setOpenPostMenu(false);
    } catch (err) {
      console.error("LỖI LƯU BÀI VIẾT:", err);
      toast.error("Đã xảy ra lỗi khi lưu bài viết.");
    }
  };

  // ================= UNLINK GOOGLE =================
  const handleUnlinkGoogle = async () => {
    if (!currentUser) return;

    if (currentUser.app_metadata?.providers?.length <= 1) {
      toast.error("Đây là phương thức đăng nhập duy nhất, không thể hủy!");
      return;
    }

    showConfirm(
      "Bạn có chắc chắn muốn hủy liên kết với Google không?",
      async () => {
        const { data } = await supabase.auth.getUser();
        const googleIdentity = data.user?.identities?.find(
          (id) => id.provider === "google",
        );

        if (!googleIdentity) return;

        const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
        if (error) {
          toast.error("Hủy liên kết thất bại: " + error.message);
        } else {
          toast.success("Đã hủy liên kết Google!");
          setCurrentUser((prev: any) => ({
            ...prev,
            app_metadata: {
              ...prev.app_metadata,
              providers: prev.app_metadata.providers.filter(
                (p: string) => p !== "google",
              ),
            },
          }));
        }
      },
    );
  };

  // ================= EDIT PROFILE HANDLERS =================
  const openEditProfile = () => {
    setEditName(profile?.name || "");
    setEditBio(profile?.bio || "");
    setEditDob(profile?.dob || "");
    setEditAddress(profile?.address || "");
    setEditGender(profile?.gender || "");
    setEditMaritalStatus(profile?.marital_status || "");
    setEditHobbies(profile?.hobbies || "");
    setEditWork(profile?.work || "");
    setEditPhone(profile?.phone || "");
    setEditAvatar(null);
    setEditCover(null);
    setEditCoverPositionY(profile?.cover_position_y ?? 50);
    setIsEditProfileOpen(true);
  };

  const saveProfile = async () => {
    if (!currentUser || !profile) return;
    setIsSavingProfile(true);
    try {
      let newAvatarUrl = profile.avatar_url ?? null;
      let newCoverUrl = profile.cover_url ?? null;

      // Nếu có chọn ảnh mới, upload lên bucket "posts"
      if (editAvatar) {
        const cleanName = editAvatar.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `avatar_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(fileName, editAvatar);

        if (uploadError) {
          throw new Error(`Lỗi tải ảnh đại diện: ${uploadError.message}`);
        }
        const { data } = supabase.storage.from("posts").getPublicUrl(fileName);
        newAvatarUrl = data.publicUrl;
      }

      if (editCover) {
        const cleanName = editCover.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `cover_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(fileName, editCover);

        if (uploadError) {
          throw new Error(`Lỗi tải ảnh bìa: ${uploadError.message}`);
        }
        const { data } = supabase.storage.from("posts").getPublicUrl(fileName);
        newCoverUrl = data.publicUrl;
      }

      // Cập nhật thông tin vào bảng users
      const { error } = await supabase
        .from("users")
        .update({
          name: editName,
          bio: editBio,
          avatar_url: newAvatarUrl,
          cover_url: newCoverUrl,
          cover_position_y: editCoverPositionY,
          dob: editDob ? editDob : null,
          address: editAddress,
          gender: editGender,
          marital_status: editMaritalStatus,
          hobbies: editHobbies,
          work: editWork,
          phone: editPhone,
        })
        .eq("id", currentUser.id);

      if (error) {
        console.error("Database update error:", error);
        throw new Error(
          error.message ||
            "Lỗi cập nhật CSDL (Có thể thiếu cột cover_position_y)",
        );
      }

      // Cập nhật giao diện ngay lập tức
      setProfile({
        ...profile,
        name: editName,
        bio: editBio,
        avatar_url: newAvatarUrl,
        cover_url: newCoverUrl,
        cover_position_y: editCoverPositionY,
        dob: editDob ? editDob : null,
        address: editAddress,
        gender: editGender,
        marital_status: editMaritalStatus,
        hobbies: editHobbies,
        work: editWork,
        phone: editPhone,
      });
      if (currentUser && currentUser.id === profile.id) {
        setCurrentUser((prev: any) => ({
          ...prev,
          name: editName,
          avatar_url: newAvatarUrl,
        }));
      }
      setIsEditProfileOpen(false);
      toast.success("Cập nhật thông tin thành công!");
    } catch (err: any) {
      console.error("Lỗi saveProfile:", err);
      toast.error(err.message || "Đã xảy ra lỗi khi lưu thông tin.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ================= DRAG COVER HANDLERS =================
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

  // ================= UI =================
  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 pt-20 text-center transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
        Đang tải...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 pt-20 text-center transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
        Không tìm thấy người dùng
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
      <div className="pt-[60px]">
        {/* ================= HEADER BÌA ================= */}
        <div className="w-full h-[200px] md:h-[300px] bg-gradient-to-r from-pink-400 to-purple-500 relative">
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              className="w-full h-full object-cover"
              style={{
                objectPosition: `50% ${profile.cover_position_y ?? 50}%`,
              }}
            />
          )}
        </div>

        <div className="max-w-[935px] mx-auto px-4 -mt-16 relative z-10 pb-24 md:pb-10">
          <div className="flex flex-col md:flex-row items-center gap-6 bg-white dark:bg-[#262626] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-800 mb-8 text-center md:text-left">
            <img
              src={
                (profile.avatar_url && profile.avatar_url !== "null"
                  ? profile.avatar_url
                  : null) ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.id}`
              }
              className="w-32 h-32 rounded-full border-4 border-white dark:border-[#262626] bg-white shadow-md object-cover flex-shrink-0"
            />

            <div className="flex-1 pb-2">
              <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-4 mb-4 md:mb-2">
                <h1 className="text-2xl font-bold">{profile.name}</h1>

                {currentUser?.id !== id ? (
                  <button
                    onClick={toggleFollow}
                    className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors ${
                      isFollowing
                        ? "bg-secondary text-gray-900 dark:text-gray-100 hover:bg-secondary/80"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                  >
                    {isFollowing ? "Đang theo dõi" : "Theo dõi"}
                  </button>
                ) : (
                  <button
                    onClick={openEditProfile}
                    className="px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors bg-secondary text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-700 hover:bg-secondary/80 shadow-sm"
                  >
                    Sửa thông tin
                  </button>
                )}
              </div>

              <div className="flex justify-center md:justify-start gap-6 text-sm mb-3">
                <span>
                  <b>{posts.length}</b> bài viết
                </span>
                <span
                  className="cursor-pointer hover:underline"
                  onClick={loadFollowers}
                >
                  <b>{followersCount}</b> người theo dõi
                </span>
                <span
                  className="cursor-pointer hover:underline"
                  onClick={loadFollowing}
                >
                  <b>{followingCount}</b> đang theo dõi
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                {profile.bio || "Chưa có thông tin giới thiệu"}
              </p>
              {profile.dob && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center md:justify-start">
                  🎂 Sinh nhật:{" "}
                  {new Date(profile.dob).toLocaleDateString("vi-VN")}
                </p>
              )}

              <div className="mt-3 text-sm text-muted-foreground space-y-1 text-center md:text-left">
                {profile.work && (
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <Briefcase size={14} /> Làm việc tại <b>{profile.work}</b>
                  </p>
                )}
                {profile.address && (
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <MapPin size={14} /> Sống tại <b>{profile.address}</b>
                  </p>
                )}
                {profile.marital_status && (
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <Heart size={14} /> <b>{profile.marital_status}</b>
                  </p>
                )}
              </div>
              {(profile.phone ||
                (currentUser?.id === profile.id && currentUser.email)) && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800 text-center md:text-left">
                  <h3 className="font-bold text-sm mb-2">Thông tin liên hệ</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {currentUser?.id === profile.id && currentUser.email && (
                      <p>
                        📧 Email: <b>{currentUser.email}</b>
                      </p>
                    )}
                    {profile.phone && (
                      <p>
                        📞 Điện thoại: <b>{profile.phone}</b>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= POSTS GRID ================= */}
          <div className="grid grid-cols-3 gap-1 mt-4">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => openPostModal(post)}
                className="aspect-square border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md dark:shadow-black/40 rounded-sm overflow-hidden relative group cursor-pointer transition-all bg-white dark:bg-[#262626]"
              >
                {post.image_urls?.[0] || post.image_url ? (
                  <img
                    src={post.image_urls?.[0] || post.image_url}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="p-4 flex items-center justify-center w-full h-full text-center text-sm md:text-base break-words">
                    {post.content}
                  </div>
                )}

                {/* Hover Dark Layer */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= MODAL POST ================= */}
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
            className={`text-gray-900 dark:text-gray-100 flex flex-col md:flex-row w-full ${selectedPost.image_url ? "max-w-5xl" : "max-w-xl"} max-h-[90vh] rounded-xl overflow-hidden shadow-2xl dark:shadow-black/60 relative animate-in fade-in zoom-in-95 duration-200 cursor-default transition-colors duration-500 bg-white dark:bg-[#262626]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Phần Ảnh */}
            {(selectedPost.image_urls?.length > 0 ||
              selectedPost.image_url) && (
              <div
                className={`flex-1 bg-[#1a1a1a] flex items-stretch justify-between relative ${selectedPost.image_urls?.length > 1 ? "h-[40vh] md:h-[85vh]" : "min-h-[300px] md:min-h-[500px]"}`}
              >
                {selectedPost.image_urls?.length > 1 && (
                  <div
                    className="w-[12%] md:w-16 shrink-0 flex items-center justify-center z-10 cursor-pointer hover:bg-black/20 transition-colors"
                    onClick={(e) =>
                      handlePrevImage(
                        e,
                        selectedPost.id,
                        selectedPost.image_urls.length - 1,
                      )
                    }
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <button className="p-2 bg-white/80 hover:bg-white dark:bg-black/50 dark:hover:bg-black/80 rounded-full shadow hover:scale-105 transition-transform">
                      <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-gray-100" />
                    </button>
                  </div>
                )}
                <div
                  className="flex-1 overflow-hidden flex items-center justify-center h-full relative group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingImage(
                      selectedPost.image_urls?.[
                        currentImageIndex[selectedPost.id] || 0
                      ] || selectedPost.image_url,
                    );
                    setImageScale(1);
                  }}
                >
                  <img
                    src={
                      selectedPost.image_urls?.[
                        currentImageIndex[selectedPost.id] || 0
                      ] || selectedPost.image_url
                    }
                    className="w-full h-full object-cover transition-all duration-300 select-none pointer-events-none"
                    alt="Post"
                  />
                </div>
                {selectedPost.image_urls?.length > 1 && (
                  <div
                    className="w-[12%] md:w-16 shrink-0 flex items-center justify-center z-10 cursor-pointer hover:bg-black/20 transition-colors"
                    onClick={(e) =>
                      handleNextImage(
                        e,
                        selectedPost.id,
                        selectedPost.image_urls.length - 1,
                      )
                    }
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <button className="p-2 bg-white/80 hover:bg-white dark:bg-black/50 dark:hover:bg-black/80 rounded-full shadow hover:scale-105 transition-transform">
                      <ChevronRight className="w-6 h-6 text-gray-900 dark:text-gray-100" />
                    </button>
                  </div>
                )}
                {selectedPost.image_urls?.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                    {selectedPost.image_urls.map((_: any, idx: number) => (
                      <div
                        key={idx}
                        className={`w-2 h-2 rounded-full shadow-sm transition-all duration-300 ${
                          (currentImageIndex[selectedPost.id] || 0) === idx
                            ? "bg-blue-500 scale-110"
                            : "bg-white/60 dark:bg-black/60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Phần Thông tin / Bình luận */}
            <div
              className={`w-full flex flex-col h-[50vh] md:h-auto transition-colors duration-500 bg-white dark:bg-[#262626] ${selectedPost.image_urls?.length > 0 || selectedPost.image_url ? "md:w-[400px] border-l border-gray-200 dark:border-neutral-800" : "md:min-h-[500px]"}`}
            >
              {/* Header & Content */}
              <div className="flex flex-col border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 pb-2 relative">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        selectedPost.users?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedPost.users?.id}`
                      }
                      className="w-10 h-10 rounded-full border object-cover"
                      alt="avatar"
                    />
                    <span className="font-semibold text-sm">
                      {selectedPost.users?.name || "Người dùng"}
                    </span>
                  </div>

                  <div className="relative">
                    <MoreHorizontal
                      className="w-5 h-5 cursor-pointer text-gray-900 dark:text-gray-100 hover:text-gray-500 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPostMenu(!openPostMenu);
                      }}
                    />
                    {openPostMenu && (
                      <div className="absolute right-0 mt-2 w-44 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl dark:shadow-black/50 py-1 z-[100] transition-colors duration-500 bg-white dark:bg-[#333333]">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSavePost(selectedPost.id);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                        >
                          <Bookmark
                            size={18}
                            className={
                              selectedPost.is_saved ? "fill-current" : ""
                            }
                          />
                          {selectedPost.is_saved
                            ? "Bỏ lưu bài viết"
                            : "Lưu bài viết"}
                        </button>

                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleReportPost(selectedPost.id);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                        >
                          <Flag size={18} />
                          Báo cáo
                        </button>

                        {currentUser?.id === selectedPost.user_id && (
                          <>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingPostId(selectedPost.id);
                                setEditPostContent(selectedPost.content || "");
                                setOpenPostMenu(false);
                              }}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                            >
                              <Pencil size={18} />
                              Sửa bài viết
                            </button>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeletePost(selectedPost.id);
                              }}
                              className="flex items-center gap-3 px-4 py-2 text-red-500 hover:bg-red-500/10 w-full text-sm font-semibold transition-all"
                            >
                              <Trash2 size={18} />
                              Xóa bài viết
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Caption */}
                {editingPostId === selectedPost.id ? (
                  <div className="px-4 pb-4 text-sm">
                    <textarea
                      className="w-full border border-border bg-secondary/30 rounded-lg p-2 outline-none focus:bg-background transition-colors resize-none"
                      value={editPostContent}
                      onChange={(e) => setEditPostContent(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-3 mt-2">
                      <button
                        onClick={() => setEditingPostId(null)}
                        className="text-xs font-semibold text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("posts")
                              .update({ content: editPostContent })
                              .eq("id", selectedPost.id);
                            if (error) throw error;

                            setSelectedPost((prev: any) => ({
                              ...prev,
                              content: editPostContent,
                            }));
                            setPosts((prev) =>
                              prev.map((p) =>
                                p.id === selectedPost.id
                                  ? { ...p, content: editPostContent }
                                  : p,
                              ),
                            );
                            setEditingPostId(null);
                            toast.success("Đã cập nhật bài viết!");
                          } catch (err) {
                            toast.error("Cập nhật thất bại.");
                          }
                        }}
                        className="text-xs font-semibold text-blue-500 hover:text-blue-600"
                      >
                        Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  selectedPost.content && (
                    <div className="px-4 pb-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {selectedPost.content}
                    </div>
                  )
                )}
              </div>

              {/* Comments */}
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
                      className={`flex items-start gap-3 group relative cursor-pointer ${
                        isReply ? "ml-10 mt-1" : "mt-4"
                      }`}
                      onDoubleClick={(e) =>
                        handleModalReplyClick(c.users?.name, e)
                      }
                    >
                      <img
                        src={
                          (c.users?.avatar_url && c.users.avatar_url !== "null"
                            ? c.users.avatar_url
                            : null) ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`
                        }
                        className={`${
                          isReply ? "w-7 h-7" : "w-10 h-10"
                        } rounded-full border object-cover flex-shrink-0`}
                        alt="avatar"
                      />
                      <div className={`${isReply ? "mt-0" : "mt-1"} flex-1`}>
                        <span
                          className={`font-semibold mr-2 ${
                            isReply ? "text-xs" : "text-sm"
                          }`}
                        >
                          {c.users?.name || "Người dùng"}
                        </span>
                        {editingCommentId === c.id ? (
                          <div className="flex flex-col gap-1 mt-1">
                            <input
                              className="border border-gray-200 dark:border-neutral-700 shadow-inner px-2 py-1 rounded-lg w-full outline-none text-sm transition-colors bg-gray-50 dark:bg-[#333333] text-gray-900 dark:text-gray-100"
                              value={editCommentText}
                              onChange={(e) =>
                                setEditCommentText(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submitEditComment(c.id);
                                if (e.key === "Escape")
                                  setEditingCommentId(null);
                              }}
                              autoFocus
                            />
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => submitEditComment(c.id)}
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
                            className={`whitespace-pre-wrap ${
                              isReply
                                ? "text-[13px] text-muted-foreground"
                                : "text-sm"
                            }`}
                          >
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
                            <div className="absolute right-0 mt-1 w-24 border border-gray-200 dark:border-neutral-700 shadow-lg dark:shadow-black/50 rounded-lg py-1 z-50 transition-colors duration-500 bg-white dark:bg-[#333333]">
                              {currentUser.id === c.user_id ? (
                                <>
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
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteComment(c.id);
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

              {/* Action / Input */}
              <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <Heart
                    onClick={() => handleLike(selectedPost.id)}
                    className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${
                      (selectedPost.is_liked ?? false)
                        ? "text-red-500 fill-red-500"
                        : "stroke-[2px] text-gray-900 dark:text-gray-100"
                    }`}
                  />
                  <span className="font-semibold text-sm">
                    {selectedPost.likes_count || 0} lượt thích
                  </span>
                  <button
                    onClick={() => setSharePost(selectedPost)}
                    className="ml-auto flex items-center gap-2 text-sm font-semibold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-full transition-colors"
                  >
                    <Send className="w-4 h-4" /> Chia sẻ
                  </button>
                </div>
                <div
                  ref={emojiPickerRef}
                  className="flex items-center gap-2 mt-3 border border-gray-200 dark:border-neutral-700 shadow-inner rounded-full px-3 py-1 bg-gray-50 dark:bg-[#333333] focus-within:bg-white dark:focus-within:bg-[#262626] transition-colors relative"
                >
                  <Smile
                    className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
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
                            onClick={() => {
                              setModalCommentText((prev) => prev + emoji);
                            }}
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

      {/* ================= MODAL EDIT PROFILE ================= */}
      {isEditProfileOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#262626]/95 p-4 transition-all"
          onClick={() => setIsEditProfileOpen(false)}
        >
          <div
            className="text-gray-900 dark:text-gray-100 w-full max-w-md max-h-[90vh] rounded-xl shadow-2xl dark:shadow-black/60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800 transition-colors duration-500 bg-white dark:bg-[#262626]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-800 shrink-0">
              <h2 className="font-bold text-lg">Sửa thông tin</h2>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="hover:text-muted-foreground transition-colors"
              >
                <X />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-col gap-4 items-center">
                {/* COVER UPLOAD */}
                <div
                  className="relative w-full h-32 bg-gray-100 dark:bg-[#333333] rounded-lg overflow-hidden flex items-center justify-center border-2 border-gray-200 dark:border-neutral-700 cursor-grab active:cursor-grabbing touch-none"
                  onMouseDown={(e) => handleDragStart(e.clientY)}
                  onMouseMove={(e) => handleDragMove(e.clientY)}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
                  onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
                  onTouchEnd={handleDragEnd}
                >
                  {(editCover || profile?.cover_url) && (
                    <img
                      src={
                        editCover
                          ? URL.createObjectURL(editCover)
                          : profile?.cover_url!
                      }
                      className="w-full h-full object-cover pointer-events-none select-none"
                      style={{ objectPosition: `50% ${editCoverPositionY}%` }}
                      alt="Cover preview"
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
                      className="hidden"
                      accept="image/*"
                      onChange={(e) =>
                        setEditCover(e.target.files?.[0] || null)
                      }
                    />
                  </label>

                  {(editCover || profile?.cover_url) && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors opacity-0 hover:opacity-100">
                      <span className="text-white bg-black/50 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm">
                        Kéo lên/xuống để căn chỉnh
                      </span>
                    </div>
                  )}
                </div>

                {/* AVATAR UPLOAD */}
                <div className="relative -mt-12">
                  <img
                    src={
                      editAvatar
                        ? URL.createObjectURL(editAvatar)
                        : (profile?.avatar_url && profile.avatar_url !== "null"
                            ? profile.avatar_url
                            : null) ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${profile?.id}`
                    }
                    className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-[#262626] shadow-sm bg-white dark:bg-neutral-800"
                    alt="Preview Avatar"
                  />
                  <label className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center text-white opacity-0 hover:opacity-100 rounded-full">
                    <Camera size={20} />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) =>
                        setEditAvatar(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Tên hiển thị
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Tiểu sử (Bio)
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors resize-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                  rows={3}
                  placeholder="Giới thiệu đôi nét về bản thân..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={editDob}
                  onChange={(e) => setEditDob(e.target.value)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Giới tính
                </label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                >
                  <option value="">Không muốn tiết lộ</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Tình trạng hôn nhân
                </label>
                <select
                  value={editMaritalStatus}
                  onChange={(e) => setEditMaritalStatus(e.target.value)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                >
                  <option value="">Không muốn tiết lộ</option>
                  <option value="Độc thân">Độc thân</option>
                  <option value="Hẹn hò">Hẹn hò</option>
                  <option value="Đã kết hôn">Đã kết hôn</option>
                  <option value="Phức tạp">Phức tạp</option>
                </select>
              </div>

              <div ref={addressRef} className="relative">
                <label className="block text-sm font-semibold mb-1">
                  Địa chỉ
                </label>
                <input
                  value={editAddress}
                  onChange={(e) => {
                    setEditAddress(e.target.value);
                    setShowAddressDropdown(true);
                  }}
                  onFocus={() => setShowAddressDropdown(true)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                  placeholder="VD: Đông Hưng, Thái Bình"
                />
                {showAddressDropdown && (
                  <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#333333] border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg">
                    {(() => {
                      const parts = editAddress.split(",");
                      const lastPart = parts[parts.length - 1]
                        .trim()
                        .toLowerCase();
                      const filtered = PROVINCES.filter((p) =>
                        p.toLowerCase().includes(lastPart),
                      );
                      if (filtered.length > 0) {
                        return filtered.map((province) => (
                          <div
                            key={province}
                            className="px-3 py-2 cursor-pointer hover:bg-secondary text-sm"
                            onClick={() => {
                              const newParts = [...parts];
                              newParts[newParts.length - 1] =
                                parts.length === 1 ? province : " " + province;
                              setEditAddress(newParts.join(",").trim());
                              setShowAddressDropdown(false);
                            }}
                          >
                            {province}
                          </div>
                        ));
                      }
                      return (
                        <div className="px-3 py-2 text-sm text-muted-foreground italic">
                          Không tìm thấy tỉnh thành
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Công việc
                </label>
                <input
                  value={editWork}
                  onChange={(e) => setEditWork(e.target.value)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                  placeholder="VD: Kỹ sư phần mềm tại Gemini"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Sở thích
                </label>
                <input
                  value={editHobbies}
                  onChange={(e) => setEditHobbies(e.target.value)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                  placeholder="VD: Đọc sách, bơi lội, du lịch"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Số điện thoại liên hệ
                </label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                  placeholder="Số điện thoại công khai (tùy chọn)"
                />
              </div>

              {/* LIÊN KẾT TÀI KHOẢN */}
              {currentUser?.id === profile?.id && (
                <div className="pt-2 border-t border-gray-200 dark:border-neutral-800 mt-2">
                  <label className="block text-sm font-semibold mb-2 mt-2">
                    Liên kết tài khoản
                  </label>
                  {currentUser?.app_metadata?.providers &&
                  currentUser.app_metadata.providers.includes("google") ? (
                    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-[#333333]">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" viewBox="0 0 48 48">
                          <path
                            fill="#FFC107"
                            d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                          ></path>
                          <path
                            fill="#FF3D00"
                            d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                          ></path>
                          <path
                            fill="#4CAF50"
                            d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                          ></path>
                          <path
                            fill="#1976D2"
                            d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.596,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                          ></path>
                        </svg>
                        <span className="text-sm font-medium">
                          Tài khoản Google
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-green-500 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                          Đã liên kết
                        </span>
                        <button
                          onClick={handleUnlinkGoogle}
                          className="text-xs font-semibold text-red-500 hover:underline"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        const { error } = await supabase.auth.linkIdentity({
                          provider: "google",
                          options: { redirectTo: window.location.origin },
                        });
                        if (error)
                          toast.error("Liên kết thất bại: " + error.message);
                      }}
                      className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" viewBox="0 0 48 48">
                          <path
                            fill="#FFC107"
                            d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                          ></path>
                          <path
                            fill="#FF3D00"
                            d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                          ></path>
                          <path
                            fill="#4CAF50"
                            d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                          ></path>
                          <path
                            fill="#1976D2"
                            d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.596,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                          ></path>
                        </svg>
                        <span className="text-sm font-medium">
                          Tài khoản Google
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-blue-500">
                        Liên kết ngay
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="px-4 py-2 rounded-lg font-semibold text-sm hover:bg-secondary transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveProfile}
                disabled={isSavingProfile}
                className="px-4 py-2 rounded-lg font-semibold text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {isSavingProfile ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
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
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Báo cáo {reportType === "post" ? "bài viết" : "bình luận"}
              </h3>
              <button
                onClick={() => setReportTargetId(null)}
                className="hover:text-gray-500 transition-colors"
              >
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
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors resize-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626] text-sm text-gray-900 dark:text-gray-100"
                rows={4}
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors rounded-lg"
                onClick={() => setReportTargetId(null)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors rounded-lg disabled:opacity-50"
                onClick={submitReport}
                disabled={!reportReason.trim()}
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL FOLLOWERS ================= */}
      {showFollowersModal && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setShowFollowersModal(false)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] max-h-[70vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-[#333333]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Người theo dõi
              </h3>
              <button
                onClick={() => setShowFollowersModal(false)}
                className="hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto">
              {followersList.length === 0 ? (
                <p className="text-center text-muted-foreground p-4 text-sm">
                  Chưa có người theo dõi nào.
                </p>
              ) : (
                followersList.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-3 hover:bg-secondary rounded-xl cursor-pointer transition-colors"
                    onClick={() => {
                      setShowFollowersModal(false);
                      router.push(`/profile/${u.id}`);
                    }}
                  >
                    <img
                      src={
                        (u.avatar_url && u.avatar_url !== "null"
                          ? u.avatar_url
                          : null) ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                      }
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-neutral-700 object-cover shadow-sm"
                      alt={u.name}
                    />
                    <span className="font-semibold text-[15px] text-gray-900 dark:text-gray-100">
                      {u.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL FOLLOWING ================= */}
      {showFollowingModal && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setShowFollowingModal(false)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] max-h-[70vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-[#333333]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Đang theo dõi
              </h3>
              <button
                onClick={() => setShowFollowingModal(false)}
                className="hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto">
              {followingList.length === 0 ? (
                <p className="text-center text-muted-foreground p-4 text-sm">
                  Chưa theo dõi ai.
                </p>
              ) : (
                followingList.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-3 hover:bg-secondary rounded-xl cursor-pointer transition-colors"
                    onClick={() => {
                      setShowFollowingModal(false);
                      router.push(`/profile/${u.id}`);
                    }}
                  >
                    <img
                      src={
                        (u.avatar_url && u.avatar_url !== "null"
                          ? u.avatar_url
                          : null) ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                      }
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-neutral-700 object-cover shadow-sm"
                      alt={u.name}
                    />
                    <span className="font-semibold text-[15px] text-gray-900 dark:text-gray-100">
                      {u.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL XEM ẢNH FULL MÀN HÌNH ================= */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[9999999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setViewingImage(null);
            setImageScale(1);
          }}
        >
          <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
            <div className="flex items-center gap-2 bg-black/50 rounded-full px-2 py-1 shadow-md">
              <button
                className="text-white hover:text-gray-300 p-2 transition-colors disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageScale((prev) => Math.max(0.5, prev - 0.25));
                }}
                disabled={imageScale <= 0.5}
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-white text-xs font-mono w-10 text-center select-none">
                {Math.round(imageScale * 100)}%
              </span>
              <button
                className="text-white hover:text-gray-300 p-2 transition-colors disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageScale((prev) => Math.min(3, prev + 0.25));
                }}
                disabled={imageScale >= 3}
              >
                <ZoomIn size={20} />
              </button>
            </div>
            <button
              className="text-white hover:text-gray-300 p-2 bg-black/50 rounded-full transition-colors shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                setViewingImage(null);
                setImageScale(1);
              }}
            >
              <X size={24} />
            </button>
          </div>
          <div className="w-full h-full overflow-auto flex items-center justify-center">
            <img
              src={viewingImage}
              alt="fullscreen-img"
              className="max-w-full max-h-screen object-contain rounded-xl shadow-2xl transition-transform duration-200"
              style={{ transform: `scale(${imageScale})` }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* ================= MODAL CHIA SẺ BÀI VIẾT ================= */}
      {sharePost && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setSharePost(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[340px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Chia sẻ bài viết
              </h3>
              <button
                onClick={() => setSharePost(null)}
                className="hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/post/${sharePost.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Đã sao chép liên kết bài viết!");
                  setSharePost(null);
                }}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-xl transition-colors text-left"
              >
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-full text-blue-600 dark:text-blue-400 shrink-0">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Sao chép liên kết
                </span>
              </button>
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/post/${sharePost.id}`;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: "InstaMini",
                        text: "Hãy xem bài viết này trên InstaMini!",
                        url: url,
                      });
                      setSharePost(null);
                    } catch (e) {}
                  } else {
                    toast.error("Trình duyệt không hỗ trợ");
                  }
                }}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#333333] hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-xl transition-colors text-left"
              >
                <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-full text-green-600 dark:text-green-400 shrink-0">
                  <Share className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Chia sẻ qua ứng dụng khác...
                </span>
              </button>
            </div>

            {/* Danh sách bạn bè */}
            {shareFriends.length > 0 && (
              <div className="px-4 pb-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
                  Gửi trực tiếp
                </span>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x [&::-webkit-scrollbar]:hidden">
                  {shareFriends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => handleSendToFriend(friend.id)}
                      className={`flex flex-col items-center gap-1.5 cursor-pointer shrink-0 w-[60px] snap-start transition-opacity ${isSharing ? "opacity-50 pointer-events-none" : "hover:opacity-80"}`}
                    >
                      <img
                        src={
                          friend.avatar_url && friend.avatar_url !== "null"
                            ? friend.avatar_url
                            : `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.id}`
                        }
                        className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-neutral-700 shadow-sm"
                      />
                      <span className="text-[11px] font-semibold text-center truncate w-full text-gray-900 dark:text-gray-100">
                        {friend.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
