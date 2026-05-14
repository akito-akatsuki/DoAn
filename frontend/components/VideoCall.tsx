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
}

export default function VideoCall({
  roomID,
  userID,
  userName,
  onLeave,
  callType,
  isGroup,
}: VideoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    let isDestroyed = false;
    let zpInstance: any = null;

    const initZego = async () => {
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
        zpRef.current = zp;

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
            isDestroyed = true;
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
      initZego();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (zpInstance && !isDestroyed) {
        isDestroyed = true;
        try {
          zpInstance.destroy();
        } catch (e) {}
      }
    };
  }, [roomID, userID, userName, callType, isGroup]);

  return (
    <div className="fixed inset-0 z-[999999] bg-[#1a1a1a] flex items-center justify-center">
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
