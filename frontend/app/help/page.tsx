"use client";

import { ChevronLeft, HelpCircle, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HelpPage() {
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
          <h1 className="text-2xl font-bold">Trung tâm Trợ giúp</h1>
        </div>

        <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden p-8 space-y-8">
          <div className="flex flex-col items-center justify-center py-6 border-b border-gray-200 dark:border-neutral-800">
            <HelpCircle className="w-16 h-16 text-blue-500 mb-4" />
            <h2 className="text-3xl font-extrabold text-center mb-2">
              Chúng tôi có thể giúp gì cho bạn?
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              Tìm kiếm câu trả lời cho các vấn đề thường gặp hoặc liên hệ trực
              tiếp với đội ngũ hỗ trợ của Apex.
            </p>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold">📌 Câu hỏi thường gặp (FAQ)</h3>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-[#333333] rounded-xl border border-gray-200 dark:border-neutral-700">
                <h4 className="font-bold mb-2">
                  Làm thế nào để đăng bài viết mới?
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Tại trang chủ, bạn nhấn vào thanh "Bạn đang nghĩ gì?" ở đầu
                  bảng tin, nhập nội dung, chọn ảnh (nếu có) và nhấn "Đăng".
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-[#333333] rounded-xl border border-gray-200 dark:border-neutral-700">
                <h4 className="font-bold mb-2">
                  Làm sao để xóa bình luận hoặc bài viết của tôi?
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Nhấn vào biểu tượng ba chấm (...) ở góc phải của bài viết hoặc
                  bình luận, sau đó chọn "Xóa". Xin lưu ý bạn chỉ có thể xóa nội
                  dung do chính mình tạo ra.
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-[#333333] rounded-xl border border-gray-200 dark:border-neutral-700">
                <h4 className="font-bold mb-2">
                  Tôi phải làm gì nếu thấy nội dung vi phạm tiêu chuẩn?
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Hệ thống AI của chúng tôi sẽ tự động làm mờ nội dung vi phạm.
                  Nếu bạn thấy nội dung nào bị sót, vui lòng nhấn nút ba chấm
                  (...) và chọn "Báo cáo" để chúng tôi xử lý.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-neutral-800">
            <h3 className="text-xl font-bold">✉️ Liên hệ Hỗ trợ</h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              Nếu bạn cần hỗ trợ thêm hoặc gặp vấn đề nghiêm trọng về tài khoản,
              vui lòng gửi email cho chúng tôi:
            </p>
            <div className="flex items-center gap-2 text-blue-500 font-semibold bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl">
              <Mail className="w-5 h-5" />
              <a href="mailto:support@apex.com">support@apex.com</a>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-neutral-800 text-center">
            <p className="text-sm text-muted-foreground">
              © 2026 APEX BY akitø. Mọi quyền được bảo lưu.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
