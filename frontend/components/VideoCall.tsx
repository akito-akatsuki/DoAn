"use client";

import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { useEffect, useRef } from "react";

interface VideoCallProps {
  roomID: string;
  userID: string;
  userName: string;
  onLeave: () => void;
  callType: "video" | "voice";
}

export default function VideoCall({
  roomID,
  userID,
  userName,
  onLeave,
  callType,
}: VideoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const isDestroyedRef = useRef(false);

  // Keep a mutable ref of the latest onLeave callback to avoid stale closures
  // and prevent triggering useEffect on every ChatBox render
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    if (!containerRef.current) return;

    let zp: any = null;

    // Timeout prevents Zego instance from crashing during React 18 Strict Mode double-invocation
    const initTimer = setTimeout(() => {
      const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID);
      const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET as string;

      if (!appID || !serverSecret) {
        console.error(
          "Thiếu thông tin NEXT_PUBLIC_ZEGO_APP_ID hoặc NEXT_PUBLIC_ZEGO_SERVER_SECRET trong file .env.local",
        );
        return;
      }

      // Sinh ra Token bảo mật để vào phòng (Lưu ý: Dùng hàm ForTest cho frontend khi làm đồ án)
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        roomID,
        userID,
        userName,
      );

      zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;

      zp.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall, // Chế độ gọi 1-1
        },
        turnOnCameraWhenJoining: callType === "video", // Mặc định tắt cam nếu là gọi thoại
        showMyCameraToggleButton: callType === "video", // Ẩn luôn nút bật/tắt cam nếu là gọi thoại
        showPreJoinView: false, // Bỏ qua màn hình test camera lúc mới vào phòng
        onLeaveRoom: () => {
          isDestroyedRef.current = true; // Đánh dấu là Zego đã tự hủy
          if (onLeaveRef.current) {
            onLeaveRef.current(); // Gọi hàm này để đóng giao diện call
          }
        },
      });
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (zp && !isDestroyedRef.current) {
        isDestroyedRef.current = true;
        zp.destroy();
      }
    };
  }, [roomID, userID, userName, callType]); // Removed onLeave from dependencies

  return (
    <div className="fixed inset-0 z-[999999] bg-[#1a1a1a] flex items-center justify-center">
      <div
        ref={containerRef}
        className="w-full h-full max-w-7xl max-h-screen"
      />
    </div>
  );
}
