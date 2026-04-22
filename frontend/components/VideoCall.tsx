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

  useEffect(() => {
    if (!containerRef.current) return;

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

    const zp = ZegoUIKitPrebuilt.create(kitToken);

    zp.joinRoom({
      container: containerRef.current,
      scenario: {
        mode: ZegoUIKitPrebuilt.OneONoneCall, // Chế độ gọi 1-1
      },
      turnOnCameraWhenJoining: callType === "video", // Mặc định tắt cam nếu là gọi thoại
      showMyCameraToggleButton: callType === "video", // Ẩn luôn nút bật/tắt cam nếu là gọi thoại
      showPreJoinView: false, // Bỏ qua màn hình test camera lúc mới vào phòng
      onLeaveRoom: () => {
        onLeave(); // Gọi hàm này để đóng giao diện call
      },
    });

    return () => {
      zp.destroy();
    };
  }, [roomID, userID, userName, onLeave, callType]);

  return (
    <div className="fixed inset-0 z-[999999] bg-[#1a1a1a] flex items-center justify-center">
      <div
        ref={containerRef}
        className="w-full h-full max-w-7xl max-h-screen"
      />
    </div>
  );
}
