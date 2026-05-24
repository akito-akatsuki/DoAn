"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[800px] mx-auto pt-24 px-4 pb-28 md:pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">Giới thiệu về InstaMini</h1>
        </div>

        <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden p-8 space-y-6">
          <div className="flex flex-col items-center justify-center py-6 border-b border-gray-200 dark:border-neutral-800">
            <h2 className="text-4xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent mb-2">
              InstaMini
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              Mạng xã hội thu nhỏ giúp bạn kết nối, chia sẻ những khoảnh khắc và
              trò chuyện cùng bạn bè một cách dễ dàng và nhanh chóng.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold">🌟 Tính năng nổi bật</h3>
            <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <b>Chia sẻ khoảnh khắc:</b> Đăng tải trạng thái, hình ảnh với
                bạn bè và người theo dõi.
              </li>
              <li>
                <b>Tương tác thả ga:</b> Thích, bình luận và trả lời bình luận
                theo thời gian thực.
              </li>
              <li>
                <b>Nhắn tin & Gọi điện:</b> Trò chuyện cá nhân, chat nhóm, gọi
                thoại và gọi video chất lượng cao hoàn toàn miễn phí.
              </li>
              <li>
                <b>Trang cộng đồng (Fanpage):</b> Tạo và quản lý trang dành cho
                cộng đồng hoặc cá nhân.
              </li>
              <li>
                <b>Kiểm duyệt thông minh:</b> Hệ thống AI hỗ trợ quét và làm mờ
                các hình ảnh, nội dung vi phạm tiêu chuẩn cộng đồng.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold">💻 Công nghệ sử dụng</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Dự án được xây dựng dựa trên các công nghệ hiện đại nhất:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <b>Frontend:</b> Next.js, React, Tailwind CSS, Lucide Icons.
              </li>
              <li>
                <b>Backend & Database:</b> Supabase (PostgreSQL, Realtime,
                Storage, Edge Functions).
              </li>
              <li>
                <b>Tính năng thời gian thực:</b> Supabase Realtime & WebRTC cho
                Video/Voice Call.
              </li>
            </ul>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-neutral-800 text-center">
            <p className="text-sm text-muted-foreground">
              © 2026 INSTAMINI BY akitø. Mọi quyền được bảo lưu.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
