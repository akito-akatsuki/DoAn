"use client";

import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { useEffect, useRef, useState } from "react";

interface VideoCallProps {
  roomID: string;
  userID: string;
  userName: string;
  onLeave: () => void;
  callType: "video" | "voice";
  isGroup?: boolean;
  startTime?: number | null;
}

export default function VideoCall({
  roomID,
  userID,
  userName,
  onLeave,
  callType,
  isGroup,
  startTime,
}: VideoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [durationStr, setDurationStr] = useState("00:00");

  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  // ================= BỘ ĐẾM THỜI GIAN =================
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(diff / 60)
        .toString()
        .padStart(2, "0");
      const s = (diff % 60).toString().padStart(2, "0");
      const h = Math.floor(diff / 3600);
      if (h > 0) {
        setDurationStr(`${h.toString().padStart(2, "0")}:${m}:${s}`);
      } else {
        setDurationStr(`${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // ================= BỘ LỌC LỖI NỘI BỘ ZEGOCLOUD =================
  // SDK ZegoCloud có lỗi nội bộ khi tắt máy đột ngột khiến các tiến trình ngầm
  // gọi vào object đã bị null (createSpan, enabled).
  // Bộ lọc này giúp đánh chặn và ẩn các bảng lỗi đỏ của Next.js để UX không bị gián đoạn.
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const msg = args[0]?.toString() || "";
      if (
        msg.includes("createSpan") ||
        msg.includes("enabled") ||
        msg.includes("Zego") ||
        msg.includes("zego")
      )
        return;
      originalConsoleError(...args);
    };

    const handleError = (e: ErrorEvent) => {
      const msg = e.message || "";
      if (
        msg.includes("createSpan") ||
        msg.includes("enabled") ||
        msg.includes("zego")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const handleRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || e.reason?.toString() || "";
      if (
        msg.includes("createSpan") ||
        msg.includes("enabled") ||
        msg.includes("zego")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      setTimeout(() => {
        console.error = originalConsoleError;
        window.removeEventListener("error", handleError);
        window.removeEventListener("unhandledrejection", handleRejection);
      }, 3000); // Giữ màng lọc 3 giây sau khi tắt máy để dọn sạch rác của Zego
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    let zpInstance: any = null;

    const initZego = () => {
      const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID);
      const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET as string;

      if (!appID || !serverSecret) {
        if (isMounted) {
          setErrorMsg(
            "Thiếu thông tin NEXT_PUBLIC_ZEGO_APP_ID hoặc NEXT_PUBLIC_ZEGO_SERVER_SECRET trong file .env.local",
          );
        }
        return;
      }

      try {
        const uniqueUserID = userID
          ? `${userID}_${Math.floor(Math.random() * 10000)}`
          : `user_${Date.now()}`;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomID,
          uniqueUserID,
          userName || "Người dùng",
        );

        if (!isMounted) return;

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpInstance = zp;

        zp.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: isGroup
              ? ZegoUIKitPrebuilt.VideoConference
              : ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnCameraWhenJoining: callType === "video",
          showMyCameraToggleButton: callType === "video",
          showPreJoinView: false,
          onLeaveRoom: () => {
            if (onLeaveRef.current) onLeaveRef.current();
          },
        });
      } catch (error: any) {
        if (isMounted) {
          setErrorMsg(
            error.message ||
              "Lỗi khi tham gia phòng (Có thể do thiết bị chặn Camera/Mic).",
          );
        }
      }
    };

    const timer = setTimeout(() => {
      if (isMounted) {
        initZego();
      }
    }, 500); // Tăng lên 500ms để tránh triệt để lỗi Strict Mode của React 18

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (zpInstance) {
        try {
          zpInstance.destroy();
        } catch (e) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Khóa cứng, đảm bảo chỉ kết nối duy nhất 1 lần

  return (
    <div className="fixed inset-0 z-[999999] bg-[#1a1a1a] flex items-center justify-center">
      {startTime && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[10] bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full text-white font-mono font-bold text-sm tracking-widest flex items-center gap-2 shadow-lg border border-white/10 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {durationStr}
        </div>
      )}

      {errorMsg && (
        <div className="absolute z-10 bg-white dark:bg-[#262626] p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-red-100 dark:border-red-900/30">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Lỗi kết nối Video
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {errorMsg}
          </p>
          <button
            onClick={onLeave}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Đóng cuộc gọi
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full max-w-7xl max-h-screen"
      />
    </div>
  );
}
