"use client";

import { ChevronLeft, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold">Điều khoản & Quyền riêng tư</h1>
        </div>

        <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden p-8 space-y-8">
          <div className="flex flex-col items-center justify-center py-6 border-b border-gray-200 dark:border-neutral-800">
            <ShieldCheck className="w-16 h-16 text-blue-500 mb-4" />
            <h2 className="text-3xl font-extrabold text-center mb-2">
              Chính sách & Điều khoản sử dụng
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              Những điều bạn cần biết khi sử dụng InstaMini để đảm bảo an toàn
              và quyền lợi cho bản thân cũng như cộng đồng.
            </p>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400">
              1. Điều khoản sử dụng
            </h3>

            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p>
                Bằng việc đăng ký và sử dụng InstaMini, bạn đồng ý tuân thủ các
                quy định dưới đây:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <b>Trách nhiệm nội dung:</b> Bạn tự chịu trách nhiệm đối với
                  mọi nội dung (bài viết, bình luận, hình ảnh) do mình đăng tải.
                </li>
                <li>
                  <b>Hành vi bị nghiêm cấm:</b> Nghiêm cấm các hành vi spam,
                  phát tán nội dung đồi trụy, bạo lực, xúc phạm người khác, hoặc
                  tuyên truyền thông tin sai lệch.
                </li>
                <li>
                  <b>Xử lý vi phạm:</b> InstaMini có quyền xóa nội dung vi phạm
                  tiêu chuẩn cộng đồng mà không cần báo trước, đồng thời có thể
                  tạm khóa hoặc khóa vĩnh viễn tài khoản của bạn.
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-gray-200 dark:border-neutral-800">
            <h3 className="text-xl font-bold text-green-600 dark:text-green-400">
              2. Quyền riêng tư
            </h3>

            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p>
                Chúng tôi tôn trọng và cam kết bảo vệ thông tin cá nhân của bạn:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <b>Thu thập thông tin:</b> Chúng tôi chỉ thu thập các thông
                  tin cần thiết như email, tên hiển thị, hình đại diện để phục
                  vụ việc tạo tài khoản và xác thực người dùng.
                </li>
                <li>
                  <b>Sử dụng dữ liệu:</b> Thông tin của bạn được sử dụng để cá
                  nhân hóa trải nghiệm, cải thiện hệ thống gợi ý và đảm bảo an
                  toàn cho nền tảng. Chúng tôi tuyệt đối không bán dữ liệu của
                  bạn cho bên thứ ba.
                </li>
                <li>
                  <b>Bảo mật an toàn:</b> Mật khẩu và thông tin nhạy cảm của bạn
                  được mã hóa an toàn bởi các công nghệ hiện đại nhất (Supabase
                  Auth).
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-gray-200 dark:border-neutral-800">
            <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400">
              3. Sử dụng Trí tuệ nhân tạo (AI)
            </h3>

            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p>
                Hệ thống InstaMini có tích hợp AI để kiểm duyệt nội dung tự
                động. Bằng cách sử dụng nền tảng, bạn đồng ý:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Hình ảnh và văn bản bạn đăng có thể được quét bởi AI để phát
                  hiện vi phạm (nhạy cảm, bạo lực, spam).
                </li>
                <li>
                  AI có thể tự động ẩn hoặc làm mờ nội dung nếu nghi ngờ vi
                  phạm. Nếu bạn cho rằng AI nhận diện sai, bạn có thể sử dụng
                  tính năng "Gửi yêu cầu xem xét lại" (Kháng nghị).
                </li>
              </ul>
            </div>
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
