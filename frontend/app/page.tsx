"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import {
  Heart,
  MessageCircle,
  Send,
  Trash2,
  MoreHorizontal,
  MessageSquare, // Thêm cái này
  X, // Thêm cái này
  Bookmark, // Icon lưu
  Smile, // Icon mặt cười
  Flag, // Icon báo cáo
  Pencil, // Icon sửa
} from "lucide-react";
import {
  getFeed,
  createPost,
  toggleLike,
  getComments,
  createComment,
  toggleSavePost,
  reportPost,
  deleteComment,
  updateComment,
  getUserPages,
} from "@/lib/api";
import { showConfirm } from "@/components/GlobalConfirm";

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [placeholder, setPlaceholder] = useState("Bạn đang nghĩ gì?");

  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});

  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const modalInputRef = useRef<HTMLInputElement | null>(null);
  const imageClickTimeout = useRef<NodeJS.Timeout | null>(null);

  // Dropdown state & Ref
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  // State cho hiệu ứng tim bay khi double click
  const [showHeartId, setShowHeartId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // ================= MODAL POST =================
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [modalCommentText, setModalCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [openPostMenu, setOpenPostMenu] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});

  // ================= COMMENT MENUS & EDIT =================
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  // ================= EDIT POST =================
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");

  // ================= REPORT POST =================
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

  const [userPages, setUserPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  // ================= LOGIN POPUP =================
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [popupView, setPopupView] = useState<"login" | "forgot">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const handlePopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    if (popupView === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      setLoginLoading(false);
      if (error) {
        toast.error(error.message || "Đăng nhập thất bại");
      } else {
        toast.success("Đăng nhập thành công!");
        setShowLoginPopup(false);
        window.location.reload();
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/login?view=update`,
      });
      setLoginLoading(false);
      if (error) {
        toast.error(error.message || "Không thể gửi email khôi phục.");
      } else {
        toast.success("Đã gửi email khôi phục! Vui lòng kiểm tra hộp thư.");
        setPopupView("login");
      }
    }
  };

  // ================= INIT =================
  useEffect(() => {
    // Kích hoạt scroll mượt toàn trang
    document.documentElement.style.scrollBehavior = "smooth";

    // Random placeholder
    const placeholders = [
      "Bạn đang nghĩ gì thế?",
      "Hôm nay của bạn thế nào?",
      "Điều gì làm bạn vui hôm nay?",
      "Chia sẻ một chút về ngày hôm nay nhé!",
      "Có câu chuyện nào thú vị không?",
    ];
    setPlaceholder(
      placeholders[Math.floor(Math.random() * placeholders.length)],
    );

    // Gọi tuần tự để tránh lỗi kẹt (deadlock) của Supabase khi tải lại trang
    const init = async () => {
      try {
        await loadUser();
        await loadFeed();
      } catch (err) {
        console.error("Lỗi khởi tạo trang chủ:", err);
      }
    };
    init();

    const channel = supabase
      .channel("posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => loadFeed(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ================= XỬ LÝ LỖI "URL STALE" (Xóa hash sau khi đăng nhập) =================
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" &&
        window.location.hash.includes("access_token")
      ) {
        // Sử dụng History API gốc thay vì router.replace để tránh lỗi Next.js chưa khởi tạo
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ================= TỰ ĐỘNG TẢI LẠI KHI ẤN NÚT QUAY LẠI (MOUSE 4) =================
  useEffect(() => {
    const handlePopState = () => {
      loadFeed(); // Chỉ tải lại bảng tin cho mượt mà (không bị chớp trắng trang)
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Xử lý Click Outside để ẩn menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        openMenuId &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpenMenuId(null);
      }
      setOpenCommentMenuId(null); // Đóng menu bình luận khi bấm ra ngoài
      setOpenPostMenu(false);

      if (
        isChatOpen &&
        chatContainerRef.current &&
        !chatContainerRef.current.contains(e.target as Node)
      ) {
        setIsChatOpen(false);
      }

      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId, isChatOpen, showEmojiPicker]);

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

  // ================= CHECK LOGIN =================
  const checkLogin = () => {
    if (!user) {
      setShowLoginPopup(true);
      return false;
    }
    return true;
  };

  const loadUser = async () => {
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

        // Lấy danh sách đang theo dõi để lọc
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", data.user.id);
        const followedIds = follows
          ? follows.map((f: any) => f.following_id)
          : [];

        // Tải danh sách Gợi ý kết bạn (những người chưa follow)
        let query = supabase
          .from("users")
          .select("id, name, avatar_url")
          .neq("id", data.user.id);

        if (followedIds.length > 0) {
          query = query.not("id", "in", `(${followedIds.join(",")})`);
        }

        const { data: suggestions } = await query.limit(5);
        if (suggestions) setSuggestedUsers(suggestions);

        const pages = await getUserPages();
        setUserPages(pages || []);
      }
    } catch (err) {
      console.error("Lỗi mạng khi tải user ở Home:", err);
    }
  };

  const handleFollowSuggested = async (
    targetId: string,
    targetName: string,
  ) => {
    if (!checkLogin()) return;
    try {
      await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: targetId,
      });
      // Xóa người vừa follow khỏi danh sách gợi ý
      setSuggestedUsers((prev) => prev.filter((u) => u.id !== targetId));
      toast.success(`Đã theo dõi ${targetName}`);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi theo dõi");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      const data = await getFeed();

      const currentUser = (await supabase.auth.getUser()).data?.user;

      // Đảm bảo hiển thị đủ dữ liệu (tự động tải bình luận và dự phòng đếm số tim)
      const enrichedData = await Promise.all(
        (data || []).map(async (post: any) => {
          // 1. Tự động load danh sách bình luận cho mỗi bài viết
          loadComments(post.id);

          // 2. Dự phòng đếm số like nếu api getFeed bị thiếu/trả về 0
          let likesCount = post.likes_count;
          if (likesCount === undefined || likesCount === 0) {
            const { count } = await supabase
              .from("likes")
              .select("*", { count: "exact", head: true })
              .eq("post_id", post.id);
            likesCount = count || 0;
          }

          // 3. Dự phòng kiểm tra trạng thái Like từ Database để chắc chắn tim đỏ
          let isLiked = post.is_liked;
          if (currentUser) {
            const { data: likeData } = await supabase
              .from("likes")
              .select("id")
              .eq("post_id", post.id)
              .eq("user_id", currentUser.id)
              .maybeSingle();
            if (likeData) isLiked = true;
          }

          return {
            ...post,
            likes_count: likesCount,
            is_liked: isLiked,
          };
        }),
      );

      setPosts(enrichedData);
    } catch (err) {
      console.error("Lỗi tải bảng tin:", err);
    } finally {
      setLoading(false);
    }
  };

  // ================= LIKE + ANIMATION =================
  const handleLike = async (postId: string, isDoubleClick = false) => {
    if (!checkLogin()) return;

    // Nếu double click, hiện trái tim giữa màn hình bài viết
    if (isDoubleClick) {
      setShowHeartId(postId);
      setTimeout(() => setShowHeartId(null), 1000);
    }

    // 🔥 OPTIMISTIC UPDATE: Cập nhật UI ngay lập tức
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

    // Gọi API ngầm phía sau để đồng bộ dữ liệu thật
    try {
      const res = await toggleLike(postId);
      // Tùy chọn: Đồng bộ lại chính xác số đếm từ server
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked: res.is_liked,
                likes_count:
                  (res as any).likes !== undefined
                    ? (res as any).likes
                    : res.likes_count,
              }
            : p,
        ),
      );
    } catch (error) {
      console.error("Lỗi khi like:", error);
    }
  };

  // ================= COMMENTS =================
  const loadComments = async (postId: string) => {
    const data = await getComments(postId);
    setCommentsMap((prev) => ({ ...prev, [postId]: data || [] }));
  };

  const handleComment = async (postId: string) => {
    const text = commentInput[postId];
    if (!checkLogin() || !text) return;

    // Xóa input ngay lập tức
    setCommentInput((prev) => ({ ...prev, [postId]: "" }));

    // 🔥 OPTIMISTIC UPDATE
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      user_id: user?.id,
      users: {
        id: user?.id,
        name:
          user?.name ||
          user?.user_metadata?.name ||
          user?.user_metadata?.full_name ||
          "Bạn",
        avatar_url: user?.avatar_url || user?.user_metadata?.avatar_url,
      },
    };

    setCommentsMap((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), tempComment],
    }));

    // Gọi API ngầm
    try {
      const newComment = await createComment(postId, text);
      // Đổi comment ảo thành comment thật (để có ID thật dùng cho việc xóa/sửa)
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) =>
          c.id === tempId ? newComment : c,
        ),
      }));
    } catch (err) {
      console.error("Lỗi khi bình luận", err);
    }
  };

  // ================= REPLY TO COMMENT =================
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

    setTimeout(() => {
      commentInputRefs.current[postId]?.focus();
    }, 50);
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

  // ================= OPEN MODAL =================
  const openPostModal = async (post: any) => {
    setSelectedPost(post);
    const data = await getComments(post.id);
    setModalComments(data || []);
  };

  const closeModal = () => {
    setSelectedPost(null);
    setModalComments([]);
    setModalCommentText("");
    setShowEmojiPicker(false);
    setOpenPostMenu(false);
    setExpandedReplies({});
  };

  const handleModalComment = async () => {
    if (!checkLogin() || !modalCommentText.trim() || !selectedPost) return;

    const text = modalCommentText;
    setModalCommentText(""); // Xóa input ngay lập tức

    // 🔥 OPTIMISTIC UPDATE
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: text,
      user_id: user?.id,
      users: {
        id: user?.id,
        name:
          user?.name ||
          user?.user_metadata?.name ||
          user?.user_metadata?.full_name ||
          "Bạn",
        avatar_url: user?.avatar_url || user?.user_metadata?.avatar_url,
      },
    };

    setModalComments((prev) => [...prev, tempComment]);
    setCommentsMap((prev) => ({
      ...prev,
      [selectedPost.id]: [...(prev[selectedPost.id] || []), tempComment],
    }));

    try {
      const newCmt = await createComment(selectedPost.id, text);
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

  // ================= DELETE COMMENT =================
  const handleDeleteComment = async (
    commentId: string,
    postId: string,
    isModal = false,
  ) => {
    showConfirm("Bạn có chắc chắn muốn xóa bình luận này?", async () => {
      try {
        await deleteComment(commentId);
        if (isModal) {
          setModalComments((prev) => prev.filter((c) => c.id !== commentId));
        }
        setCommentsMap((prev) => ({
          ...prev,
          [postId]: prev[postId]?.filter((c) => c.id !== commentId) || [],
        }));
        setOpenCommentMenuId(null);
      } catch (err) {
        console.error(err);
        toast.error("Xóa bình luận thất bại.");
      }
    });
  };

  // ================= EDIT COMMENT =================
  const submitEditComment = async (
    commentId: string,
    postId: string,
    isModal = false,
  ) => {
    if (!editCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editCommentText);
      if (isModal) {
        setModalComments((prev) =>
          prev.map((c) => (c.id === commentId ? updated : c)),
        );
      }
      setCommentsMap((prev) => ({
        ...prev,
        [postId]:
          prev[postId]?.map((c) => (c.id === commentId ? updated : c)) || [],
      }));
      setEditingCommentId(null);
      setOpenCommentMenuId(null);
    } catch (err) {
      console.error(err);
      toast.error("Sửa bình luận thất bại.");
    }
  };

  // ================= IMAGE CLICK HANDLERS =================
  const handleImageClick = (post: any) => {
    if (imageClickTimeout.current) {
      clearTimeout(imageClickTimeout.current);
    }
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

  // ================= DELETE POST =================
  const handleDeletePost = async (postId: string) => {
    showConfirm("Bạn có chắc chắn muốn xóa bài viết này không?", async () => {
      try {
        // Gọi trực tiếp Supabase để xóa bài
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", postId);
        if (error) throw error;

        // 🔥 update UI ngay
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setOpenMenuId(null);
      } catch (err) {
        console.error("DELETE ERROR:", err);
        toast.error("Xóa bài viết thất bại.");
      }
    });
  };

  // ================= SAVE POST =================
  const handleSavePost = async (postId: string) => {
    if (!checkLogin()) return;
    try {
      const { is_saved } = await toggleSavePost(postId);
      // Cập nhật lại UI cho bài viết ở ngoài trang chủ
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved } : p)),
      );
      // Cập nhật lại UI nếu Modal đang bật
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost((prev: any) => ({ ...prev, is_saved }));
      }
      toast.success(
        is_saved ? "Đã lưu bài viết thành công!" : "Đã bỏ lưu bài viết!",
      );
      setOpenMenuId(null);
      setOpenPostMenu(false);
    } catch (err) {
      console.error("SAVE POST ERROR:", err);
      toast.error("Đã xảy ra lỗi khi lưu bài viết.");
    }
  };

  // ================= REPORT POST =================
  const handleReportPost = (postId: string) => {
    if (!checkLogin()) return;
    setReportPostId(postId);
    setReportReason("");
    setOpenMenuId(null);
    setOpenPostMenu(false);
  };

  const submitReport = async () => {
    if (!reportPostId || !reportReason.trim()) return;
    try {
      await reportPost(reportPostId, reportReason);
      toast.success("Đã gửi báo cáo thành công!");
      setReportPostId(null);
      setReportReason("");
    } catch (err) {
      console.error("REPORT POST ERROR:", err);
      toast.error("Đã xảy ra lỗi khi báo cáo bài viết.");
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-500 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100">
      {" "}
      {/* select-none ở root để mượt hơn khi double click */}
      <main className="pt-24 max-w-[1200px] mx-auto px-4 pb-24 md:pb-10 flex justify-center gap-8">
        {/* ================= CỘT TRÁI: THÔNG TIN ================= */}
        <div className="hidden xl:flex w-[320px] shrink-0 justify-end items-start">
          <div className="sticky top-[100px] w-[240px] h-fit">
            <div className="text-[13px] text-muted-foreground space-y-4">
              <div className="flex flex-col gap-y-4 font-medium">
                <a
                  href="#"
                  className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Giới thiệu
                </a>
                <a
                  href="#"
                  className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Trợ giúp
                </a>
                <a
                  href="#"
                  className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  API
                </a>
                <a
                  href="#"
                  className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Quyền riêng tư
                </a>
                <a
                  href="#"
                  className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Điều khoản
                </a>
              </div>
              <p className="pt-4 mt-4 border-t border-gray-200 dark:border-neutral-800 text-[12px]">
                © 2026 INSTAMINI BY akitø
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[470px]">
          {/* CREATE POST */}
          {!user ? (
            <div
              onClick={() => setShowLoginPopup(true)}
              className="shadow-md rounded-[12px] p-4 mb-4 border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#262626] cursor-pointer flex items-center gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-[#333333]"
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-neutral-700 flex-shrink-0" />
              <div className="flex-1 bg-gray-100 dark:bg-[#333333] rounded-full px-4 py-2.5 text-sm text-muted-foreground font-medium text-left">
                Đăng nhập để chia sẻ suy nghĩ của bạn...
              </div>
            </div>
          ) : (
            <div className="shadow-md hover:shadow-lg dark:shadow-black/40 rounded-[12px] p-4 mb-4 border border-gray-200 dark:border-neutral-800 transition-all duration-500 bg-white dark:bg-[#262626]">
              {userPages.length > 0 && (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-xs text-muted-foreground font-medium">
                    Đăng bài dưới tư cách:
                  </span>
                  <div className="relative">
                    <select
                      value={selectedPageId || "user"}
                      onChange={(e) =>
                        setSelectedPageId(
                          e.target.value === "user" ? null : e.target.value,
                        )
                      }
                      className="appearance-none cursor-pointer text-sm border border-gray-200 dark:border-neutral-700 rounded-full pl-3 pr-8 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] outline-none font-bold text-gray-800 dark:text-gray-100 transition-colors shadow-sm"
                    >
                      <option value="user">{user?.name || "Cá nhân"}</option>
                      {userPages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-500 dark:text-gray-400">
                      <svg
                        className="fill-current h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-4">
                <img
                  src={
                    (selectedPageId
                      ? userPages.find((p) => p.id === selectedPageId)
                          ?.avatar_url
                      : user?.avatar_url || user?.user_metadata?.avatar_url) ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedPageId || user?.id}`
                  }
                  className="w-10 h-10 rounded-full ring-1 ring-border flex-shrink-0 mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() =>
                    router.push(
                      selectedPageId
                        ? `/fanpage/${selectedPageId}`
                        : `/profile/${user?.id}`,
                    )
                  }
                  alt="Your avatar"
                />
                <div className="flex-1 min-w-0">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={placeholder}
                    className="w-full text-base resize-none outline-none min-h-[80px] text-gray-900 dark:text-gray-100 font-semibold bg-transparent pt-1 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    rows={2}
                  />

                  {/* IMAGE PREVIEW */}
                  {file && (
                    <div className="relative mb-3 inline-block mt-2">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Preview"
                        className="max-h-48 rounded-lg object-contain border border-border shadow-sm"
                      />
                      <button
                        onClick={() => setFile(null)}
                        className="absolute -top-2 -right-2 bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-gray-100 rounded-full p-1 shadow-md hover:bg-secondary transition-colors z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1 text-primary text-sm cursor-pointer hover:underline">
                      📷 Ảnh
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="hidden"
                        accept="image/*"
                      />
                    </label>
                    <button
                      onClick={async () => {
                        if (!content && !file) return;

                        try {
                          let imageUrl = null;

                          // ================= UPLOAD IMAGE =================
                          if (file) {
                            const cleanName = file.name.replace(
                              /[^a-zA-Z0-9.]/g,
                              "_",
                            );
                            const fileName = `${Date.now()}_${cleanName}`;

                            const { error: uploadError } =
                              await supabase.storage
                                .from("posts")
                                .upload(fileName, file);

                            if (uploadError) {
                              console.error(
                                "UPLOAD ERROR:",
                                uploadError.message,
                              );
                              return;
                            }

                            const { data } = supabase.storage
                              .from("posts")
                              .getPublicUrl(fileName);

                            imageUrl = data.publicUrl;
                          }

                          // ================= KIỂM DUYỆT AI =================
                          let is_flagged = false;
                          if (content) {
                            try {
                              const modRes = await fetch("/api/moderate", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ content }),
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

                          // ================= CHẶN & XÓA BÀI VI PHẠM =================
                          if (is_flagged) {
                            // Nếu có ảnh đi kèm thì xóa luôn ảnh đó khỏi Supabase Storage để tránh rác dữ liệu
                            if (imageUrl) {
                              const uploadedFileName = imageUrl
                                .split("/")
                                .pop();
                              if (uploadedFileName) {
                                await supabase.storage
                                  .from("posts")
                                  .remove([uploadedFileName]);
                              }
                            }
                            return; // Dừng lại ngay lập tức, không cho phép chạy lệnh createPost()
                          }

                          // ================= CREATE POST =================
                          const newPost = await createPost({
                            content,
                            image_url: imageUrl,
                            is_flagged,
                            page_id: selectedPageId,
                          });

                          if (!newPost) {
                            console.error("CREATE POST FAILED");
                            return;
                          }

                          // ================= UPDATE UI =================
                          setPosts((prev) => [newPost, ...prev]);

                          // ================= RESET =================
                          setContent("");
                          setFile(null);
                          setSelectedPageId(null);
                        } catch (err) {
                          console.error("POST ERROR:", err);
                        }
                      }}
                      disabled={!content && !file}
                      className="bg-gradient-to-r from-primary to-accent text-primary-fg px-5 py-1.5 rounded-full font-semibold text-sm shadow-ig hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Đăng
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FEED */}
          <div className="space-y-3">
            {loading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}

            {posts.map((post) => (
              <div
                key={post.id}
                className="shadow-md hover:shadow-lg dark:shadow-black/40 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 relative transition-all duration-500 bg-white dark:bg-[#262626]"
                onDoubleClick={() => handleLike(post.id, true)}
              >
                {/* BIG HEART POP ANIMATION */}
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
                        post.users?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${post.pages?.id || post.user_id}`
                      }
                      onClick={() =>
                        router.push(
                          post.pages
                            ? `/fanpage/${post.pages.id}`
                            : `/profile/${post.user_id}`,
                        )
                      }
                      className="w-10 h-10 rounded-full ring-1 ring-border cursor-pointer hover:brightness-105 object-cover"
                    />
                    <div>
                      <span
                        onClick={() =>
                          router.push(
                            post.pages
                              ? `/fanpage/${post.pages.id}`
                              : `/profile/${post.user_id}`,
                          )
                        }
                        className="font-semibold text-sm block leading-tight cursor-pointer hover:underline"
                      >
                        {post.pages?.name || post.users?.name || "unknown"}
                      </span>
                      <span className="text-xs text-muted leading-tight mt-0.5 block">
                        {post.pages && (
                          <>
                            Đăng bởi{" "}
                            <strong
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/profile/${post.user_id}`);
                              }}
                              className="cursor-pointer hover:underline text-gray-900 dark:text-gray-100"
                            >
                              {post.users?.name}
                            </strong>
                            {" • "}
                          </>
                        )}
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
                        e.stopPropagation(); // Ngăn sự kiện click outside ngay lập tức
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
                        className="absolute right-0 mt-2 w-44 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl dark:shadow-black/50 py-1 z-[100] transition-colors duration-500 bg-white dark:bg-[#333333]"
                      >
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSavePost(post.id);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                        >
                          <Bookmark
                            size={18}
                            className={post.is_saved ? "fill-current" : ""}
                          />
                          {post.is_saved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                        </button>

                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleReportPost(post.id);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                        >
                          <Flag size={18} />
                          Báo cáo
                        </button>

                        {/* Chỉ hiện nút Xóa nếu là bài viết của chính người dùng */}
                        {user?.id === post.user_id && (
                          <>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingPostId(post.id);
                                setEditPostContent(post.content || "");
                                setOpenMenuId(null);
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
                                handleDeletePost(post.id);
                              }}
                              className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-500/10 w-full text-sm font-semibold transition-all"
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

                {/* NỘI DUNG (CONTENT) */}
                {editingPostId === post.id ? (
                  <div className="px-4 pb-3 text-sm">
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
                        onClick={() => handleSavePost(post.id)}
                        className="text-xs font-semibold text-blue-500 hover:text-blue-600"
                      >
                        Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  post.content && (
                    <div
                      className={`px-4 pb-3 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 ${post.is_flagged ? "text-red-500 font-semibold italic" : ""}`}
                    >
                      {post.is_flagged
                        ? "Nội dung này đã bị ẩn do vi phạm tiêu chuẩn cộng đồng."
                        : post.content}
                    </div>
                  )
                )}

                {/* IMAGE WITH DOUBLE CLICK LIKE */}
                {post.image_url && (
                  <div className="relative overflow-hidden bg-gray-100 dark:bg-[#1a1a1a]">
                    <img
                      src={post.image_url}
                      className={`w-full h-auto max-h-[650px] object-cover object-center cursor-pointer hover:brightness-[0.98] transition-all duration-300 select-none pointer-events-none ${post.is_flagged ? "blur-xl scale-110" : ""}`}
                      alt="Post content"
                    />

                    {post.is_flagged && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/30 z-20 pointer-events-none">
                        <Flag className="w-12 h-12 mb-2 text-red-500 drop-shadow-md" />
                        <span className="font-bold text-lg drop-shadow-md">
                          Hình ảnh nhạy cảm
                        </span>
                        <span className="text-sm drop-shadow-md">
                          Bài viết đã bị gắn cờ bởi AI
                        </span>
                      </div>
                    )}

                    {/* Overlay ẩn để catch event tốt hơn */}
                    <div
                      className="absolute inset-0 z-10 cursor-pointer"
                      onClick={() => handleImageClick(post)}
                      onDoubleClick={(e) => handleImageDoubleClick(e, post)}
                    />
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
                      className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${
                        (post.is_liked ?? false)
                          ? "text-red-500 fill-red-500" // Đổi từ destructive sang red-500 cho chắc chắn
                          : "stroke-[2px] text-gray-900 dark:text-gray-100"
                      }`}
                    />
                    <MessageCircle
                      onClick={() => openPostModal(post)}
                      className="w-7 h-7 cursor-pointer stroke-[2px]"
                    />
                    <Send className="w-7 h-7 cursor-pointer stroke-[2px]" />
                  </div>

                  <p className="text-sm font-bold mt-1">
                    {post.likes_count || 0} lượt thích
                  </p>

                  {/* COMMENTS SECTION */}
                  <div className="mt-2 space-y-1">
                    {/* Nút Xem tất cả bình luận nếu có nhiều hơn 1 */}
                    {commentsMap[post.id]?.length > 1 && (
                      <p
                        className="text-sm text-muted-foreground cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-1"
                        onClick={() => openPostModal(post)}
                      >
                        Xem tất cả {commentsMap[post.id].length} bình luận
                      </p>
                    )}

                    {/* Giới hạn hiển thị 1 bình luận ở ngoài Feed */}
                    {commentsMap[post.id]
                      ?.slice(0, 1)
                      .map((c: any, idx: number) => {
                        const isReply = c.content?.trim().startsWith("@");
                        return (
                          <div
                            key={c.id ?? idx}
                            className={`flex justify-between items-start group cursor-pointer transition-all ${
                              isReply
                                ? "ml-6 text-[13px] border-l-[2px] border-border/70 pl-2 mt-1"
                                : "text-sm mt-2"
                            }`}
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
                                <span>{c.content}</span>
                              )}
                            </div>

                            {user?.id === c.user_id && !editingCommentId && (
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
                                  <div className="absolute right-0 mt-1 w-24 border border-gray-200 dark:border-neutral-700 shadow-lg dark:shadow-black/50 rounded-lg py-1 z-50 transition-colors duration-500 bg-white dark:bg-[#333333]">
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
                                        handleDeleteComment(c.id, post.id);
                                      }}
                                      className="w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-secondary"
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* ADD COMMENT */}
                  <div className="flex items-center gap-3 pt-3 mt-2 border-t border-border">
                    <img
                      src={
                        user?.avatar_url ||
                        user?.user_metadata?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.id}`
                      }
                      className="w-7 h-7 rounded-full flex-shrink-0"
                      alt="User"
                    />
                    <input
                      ref={(el) => {
                        commentInputRefs.current[post.id] = el;
                      }}
                      value={commentInput[post.id] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCommentInput((prev) => ({
                          ...prev,
                          [post.id]: value,
                        }));
                      }}
                      onFocus={(e) => {
                        if (!user) {
                          e.target.blur();
                          setShowLoginPopup(true);
                        }
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400"
                      placeholder="Thêm bình luận..."
                    />
                    {commentInput[post.id] && (
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

        {/* ================= CỘT PHẢI: GỢI Ý KẾT BẠN ================= */}
        <div className="hidden lg:block w-[320px] shrink-0">
          <div className="sticky top-[100px]">
            {/* PROFILE MINI CỦA MÌNH */}

            {/* DANH SÁCH GỢI Ý */}
            <div className="flex items-center justify-between mb-4 mt-2">
              <p className="text-sm font-bold text-muted-foreground">
                Gợi ý cho bạn
              </p>
              <button
                onClick={() => router.push("/suggested")}
                className="text-xs font-bold hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Xem tất cả
              </button>
            </div>

            <div className="space-y-4">
              {suggestedUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => router.push(`/profile/${u.id}`)}
                  >
                    <img
                      src={
                        u.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`
                      }
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-neutral-700 object-cover shadow-sm"
                      alt={u.name}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[14px] truncate max-w-[130px]">
                        {u.name}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        Gợi ý kết bạn
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFollowSuggested(u.id, u.name)}
                    className="text-xs font-bold text-blue-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Theo dõi
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
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
            {selectedPost.image_url && (
              <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center min-h-[300px] md:min-h-[500px]">
                <img
                  src={selectedPost.image_url}
                  className="w-full h-full object-cover object-center"
                  alt="Post"
                />
              </div>
            )}

            {/* Phần Thông tin / Bình luận */}
            <div
              className={`w-full flex flex-col h-[50vh] md:h-auto transition-colors duration-500 bg-white dark:bg-[#262626] ${selectedPost.image_url ? "md:w-[400px] border-l border-gray-200 dark:border-neutral-800" : "md:min-h-[500px]"}`}
            >
              {/* Header & Content */}
              <div className="flex flex-col border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#333333]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 pb-2 relative">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        selectedPost.pages?.avatar_url ||
                        selectedPost.users?.avatar_url ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedPost.pages?.id || selectedPost.users?.id}`
                      }
                      className="w-10 h-10 rounded-full border object-cover cursor-pointer hover:opacity-80"
                      alt="avatar"
                      onClick={() => {
                        closeModal();
                        router.push(
                          selectedPost.pages
                            ? `/fanpage/${selectedPost.pages.id}`
                            : `/profile/${selectedPost.user_id}`,
                        );
                      }}
                    />
                    <div className="flex flex-col">
                      <span
                        className="font-semibold text-sm cursor-pointer hover:underline"
                        onClick={() => {
                          closeModal();
                          router.push(
                            selectedPost.pages
                              ? `/fanpage/${selectedPost.pages.id}`
                              : `/profile/${selectedPost.user_id}`,
                          );
                        }}
                      >
                        {selectedPost.pages?.name ||
                          selectedPost.users?.name ||
                          "Người dùng"}
                      </span>
                      {selectedPost.pages && (
                        <span className="text-xs text-muted-foreground">
                          Đăng bởi{" "}
                          <strong
                            className="cursor-pointer hover:underline text-gray-900 dark:text-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeModal();
                              router.push(`/profile/${selectedPost.user_id}`);
                            }}
                          >
                            {selectedPost.users?.name}
                          </strong>
                        </span>
                      )}
                    </div>
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
                            setOpenPostMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-secondary w-full text-sm font-semibold transition-all"
                        >
                          <Flag size={18} />
                          Báo cáo
                        </button>

                        {user?.id === selectedPost.user_id && (
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeletePost(selectedPost.id);
                              closeModal();
                            }}
                            className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-500/10 w-full text-sm font-semibold transition-all"
                          >
                            <Trash2 size={18} />
                            Xóa bài viết
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Caption */}
                {selectedPost.content && (
                  <div className="px-4 pb-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {selectedPost.content}
                  </div>
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
                          c.users?.avatar_url ||
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
                              className="border border-gray-200 dark:border-neutral-700 px-2 py-1 rounded-lg w-full outline-none text-sm bg-transparent"
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
                            className={`whitespace-pre-wrap ${
                              isReply
                                ? "text-[13px] text-muted-foreground"
                                : "text-sm"
                            }`}
                          >
                            {c.content}
                          </span>
                        )}
                      </div>

                      {user?.id === c.user_id && !editingCommentId && (
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(selectedPost.id);
                    }}
                    className={`cursor-pointer transition-all active:scale-150 hover:scale-110 w-7 h-7 ${
                      (selectedPost.is_liked ?? false)
                        ? "text-red-500 fill-red-500"
                        : "stroke-[2px] text-gray-900 dark:text-gray-100"
                    }`}
                  />
                  <span className="font-semibold text-sm">
                    {selectedPost.likes_count || 0} lượt thích
                  </span>
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
                    onFocus={(e) => {
                      if (!user) {
                        e.target.blur();
                        setShowLoginPopup(true);
                      }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleModalComment()}
                  />
                  <button
                    onClick={handleModalComment}
                    disabled={!modalCommentText.trim()}
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
      {/* FIXED CHAT UI */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-4">
        {/* Khung ChatBox hiện lên khi nhấn nút */}
        {isChatOpen && user && (
          <div className="w-[380px] h-[550px] bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl dark:shadow-black/50 border border-gray-200 dark:border-neutral-800 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 transition-colors duration-500">
            <ChatBox userId={user.id} onClose={() => setIsChatOpen(false)} />
          </div>
        )}

        {/* Nút tròn để Toggle Chat */}
        <button
          onClick={() => {
            if (!checkLogin()) return;
            setIsChatOpen(!isChatOpen);
          }}
          className={`shadow-2xl transition-all active:scale-90 p-4 rounded-full flex items-center justify-center ${
            isChatOpen
              ? "bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-800"
              : "bg-[#0095F6] text-white hover:bg-blue-600"
          }`}
        >
          {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>
      </div>
      {/* ================= MODAL REPORT POST ================= */}
      {reportPostId && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => setReportPostId(null)}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Báo cáo bài viết
              </h3>
              <button
                onClick={() => setReportPostId(null)}
                className="hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Vui lòng nhập lý do báo cáo bài viết này. Quản trị viên sẽ xem
                xét báo cáo của bạn.
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
                onClick={() => setReportPostId(null)}
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
      {/* ================= MODAL LOGIN REQUIREMENT ================= */}
      {showLoginPopup && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
          onClick={() => {
            setShowLoginPopup(false);
            setPopupView("login");
          }}
        >
          <div
            className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center pb-4">
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100 mb-1">
                {popupView === "login"
                  ? "Yêu cầu đăng nhập"
                  : "Khôi phục mật khẩu"}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                {popupView === "login"
                  ? "Vui lòng đăng nhập để tiếp tục!"
                  : "Nhập email để nhận liên kết khôi phục."}
              </p>
            </div>

            <form
              onSubmit={handlePopupSubmit}
              className="px-6 pb-4 flex flex-col gap-3"
            >
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-neutral-700 shadow-inner p-2.5 rounded-lg outline-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#202020] text-gray-900 dark:text-gray-100 transition-colors text-sm"
              />
              {popupView === "login" && (
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 dark:border-neutral-700 shadow-inner p-2.5 rounded-lg outline-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#202020] text-gray-900 dark:text-gray-100 transition-colors text-sm"
                />
              )}

              {popupView === "login" && (
                <div className="flex justify-end mt-[-4px]">
                  <button
                    type="button"
                    onClick={() => setPopupView("forgot")}
                    className="text-xs font-medium text-blue-500 hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition disabled:opacity-50 text-sm mt-1"
              >
                {loginLoading
                  ? "Đang xử lý..."
                  : popupView === "login"
                    ? "Đăng nhập"
                    : "Gửi email khôi phục"}
              </button>
            </form>

            <div className="flex flex-col border-t border-gray-200 dark:border-neutral-800">
              {popupView === "login" ? (
                <>
                  <button
                    className="w-full py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors border-b border-gray-200 dark:border-neutral-800 flex justify-center items-center gap-2"
                    onClick={() => {
                      supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: { redirectTo: window.location.origin },
                      });
                    }}
                  >
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
                    Đăng nhập với Google
                  </button>
                  <button
                    className="w-full py-3 text-sm font-semibold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-200 dark:border-neutral-800"
                    onClick={() => {
                      setShowLoginPopup(false);
                      router.push("/login?view=register");
                    }}
                  >
                    Chưa có tài khoản? Đăng ký
                  </button>
                </>
              ) : (
                <button
                  className="w-full py-3 text-sm font-semibold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-200 dark:border-neutral-800"
                  onClick={() => setPopupView("login")}
                >
                  Quay lại đăng nhập
                </button>
              )}
              <button
                className="w-full py-3 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors"
                onClick={() => {
                  setShowLoginPopup(false);
                  setPopupView("login");
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Tailwind Extra Styles for Animations */}
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
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
