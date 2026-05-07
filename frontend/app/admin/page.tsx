"use client";

import { useEffect, useState } from "react";
import {
  getPendingReports,
  resolveReport,
  getPendingAppeals,
  resolveAppeal,
} from "@/lib/api";
import toast from "react-hot-toast";
import {
  ShieldAlert,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
} from "lucide-react";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [adminMessage, setAdminMessage] = useState("");

  const [activeTab, setActiveTab] = useState<"reports" | "appeals">("reports");
  const [appeals, setAppeals] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "reports") {
      loadReports();
    } else {
      loadAppeals();
    }
  }, [activeTab]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await getPendingReports();
      setReports(data || []);
    } catch (err) {
      toast.error("Không thể tải danh sách báo cáo");
    } finally {
      setLoading(false);
    }
  };

  const loadAppeals = async () => {
    setLoading(true);
    try {
      const data = await getPendingAppeals();
      setAppeals(data || []);
    } catch (err) {
      toast.error("Không thể tải danh sách kháng nghị");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (report: any, action: "delete" | "keep") => {
    if (!report) return;
    if (action === "delete" && !adminMessage.trim()) {
      toast.error("Vui lòng nhập lý do xóa để gửi cho người dùng!");
      return;
    }

    // Cập nhật giao diện ngay lập tức (Optimistic Update) giúp thẻ báo cáo biến mất ngay
    setReports((prev) => prev.filter((r) => r.id !== report.id));

    const commentData = Array.isArray(report.comments)
      ? report.comments[0]
      : report.comments;
    const postData = Array.isArray(report.posts)
      ? report.posts[0]
      : report.posts;

    try {
      await resolveReport(
        report.id,
        postData?.id,
        postData?.user_id,
        action,
        adminMessage,
        commentData?.id,
        commentData?.user_id,
      );
      toast.success(
        action === "delete"
          ? "Đã gỡ bài và gửi thông báo!"
          : "Đã bỏ qua báo cáo!",
      );
      setSelectedReport(null);
      setAdminMessage("");
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi xử lý!");
      loadReports(); // Tải lại danh sách gốc nếu server trả về lỗi
    }
  };

  const handleResolveAppeal = async (
    appeal: any,
    action: "restore" | "reject",
  ) => {
    if (!appeal) return;
    setAppeals((prev) => prev.filter((a) => a.id !== appeal.id));

    try {
      await resolveAppeal(
        appeal.id,
        appeal.posts?.id,
        appeal.posts?.user_id,
        action,
      );
      toast.success(
        action === "restore"
          ? "Đã khôi phục bài viết!"
          : "Đã từ chối kháng nghị!",
      );
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi xử lý!");
      loadAppeals();
    }
  };

  return (
    <div className="min-h-screen pt-24 px-4 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert className="w-8 h-8 text-red-500" />
          <h1 className="text-2xl font-bold">Trung tâm kiểm duyệt báo cáo</h1>
        </div>

        <div className="flex border-b border-gray-200 dark:border-neutral-800 mb-6">
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 py-3 text-center font-semibold transition-colors ${activeTab === "reports" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
          >
            Báo cáo chờ duyệt
          </button>
          <button
            onClick={() => setActiveTab("appeals")}
            className={`flex-1 py-3 text-center font-semibold transition-colors ${activeTab === "appeals" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
          >
            Kháng nghị
          </button>
        </div>

        {activeTab === "reports" &&
          (loading ? (
            <div className="text-center py-10">Đang tải báo cáo...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#262626] rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold">
                Không có báo cáo nào đang chờ xử lý.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {reports.map((report) => {
                const commentData = Array.isArray(report.comments)
                  ? report.comments[0]
                  : report.comments;
                const postData = Array.isArray(report.posts)
                  ? report.posts[0]
                  : report.posts;

                return (
                  <div
                    key={report.id}
                    className="bg-white dark:bg-[#262626] p-5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <span className="font-bold">
                        Bị báo cáo bởi:{" "}
                        <span className="text-blue-500">
                          {report.users?.name}
                        </span>
                      </span>
                    </div>
                    <p className="text-red-500 font-semibold mb-4 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                      Lý do: {report.reason}
                    </p>

                    <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 bg-gray-50 dark:bg-[#333333] mb-4">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                        {commentData
                          ? "Nội dung bình luận bị tố cáo:"
                          : "Nội dung bài viết bị tố cáo:"}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {commentData
                          ? commentData.content || "Không có nội dung text"
                          : postData?.content || "Không có nội dung text"}
                      </p>
                      {postData?.image_url && !commentData && (
                        <img
                          src={postData.image_url}
                          alt="Bằng chứng"
                          className="mt-3 max-h-40 rounded-lg border border-gray-200 dark:border-neutral-700"
                        />
                      )}
                      {commentData?.image_url && (
                        <img
                          src={commentData.image_url}
                          alt="Bằng chứng bình luận"
                          className="mt-3 max-h-40 rounded-lg border border-gray-200 dark:border-neutral-700"
                        />
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setAdminMessage(report.reason); // Gán sẵn lý do mặc định
                        }}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition"
                      >
                        <Trash2 className="w-5 h-5" />{" "}
                        {commentData ? "Xóa bình luận" : "Gỡ bài (Ẩn)"}
                      </button>
                      <button
                        onClick={() => handleResolve(report, "keep")}
                        className="flex-1 bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 font-bold py-2 rounded-lg transition"
                      >
                        Bỏ qua báo cáo (Bài hợp lệ)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {activeTab === "appeals" &&
          (loading ? (
            <div className="text-center py-10">Đang tải kháng nghị...</div>
          ) : appeals.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#262626] rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold">
                Không có kháng nghị nào đang chờ xử lý.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {appeals.map((appeal) => (
                <div
                  key={appeal.id}
                  className="bg-white dark:bg-[#262626] p-5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-blue-500" />
                    <span className="font-bold">
                      Kháng nghị từ:{" "}
                      <span className="text-blue-500">
                        {appeal.users?.name}
                      </span>
                    </span>
                  </div>
                  <p className="text-blue-600 font-semibold mb-4 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                    Lý do: {appeal.reason}
                  </p>

                  <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 bg-gray-50 dark:bg-[#333333] mb-4 opacity-75">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                      Bài viết đã bị gỡ:
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {appeal.posts?.content || "Không có nội dung text"}
                    </p>
                    {appeal.posts?.image_url && (
                      <img
                        src={appeal.posts.image_url}
                        alt="Bài viết"
                        className="mt-3 max-h-40 rounded-lg border border-gray-200 dark:border-neutral-700"
                      />
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleResolveAppeal(appeal, "restore")}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition"
                    >
                      <CheckCircle className="w-5 h-5" /> Khôi phục bài viết
                    </button>
                    <button
                      onClick={() => handleResolveAppeal(appeal, "reject")}
                      className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 font-bold py-2 rounded-lg transition"
                    >
                      Từ chối kháng nghị
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* Modal Xóa bài */}
        {selectedReport && (
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSelectedReport(null)}
          >
            <div
              className="bg-white dark:bg-[#262626] p-6 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Xác nhận xử lý</h2>
                <X
                  className="w-6 h-6 cursor-pointer"
                  onClick={() => setSelectedReport(null)}
                />
              </div>
              <p className="text-sm mb-2 text-muted-foreground">
                Nhập lời nhắn giải thích cho người đăng (họ sẽ nhận được thông
                báo này):
              </p>
              <textarea
                className="w-full border border-gray-300 dark:border-neutral-700 rounded-lg p-3 outline-none mb-4 bg-gray-50 dark:bg-[#333333]"
                rows={4}
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                placeholder="Ví dụ: Hình ảnh của bạn chứa nội dung phản cảm..."
              />
              <button
                onClick={() => handleResolve(selectedReport, "delete")}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg transition"
              >
                {(
                  Array.isArray(selectedReport.comments)
                    ? selectedReport.comments[0]
                    : selectedReport.comments
                )
                  ? "Xóa bình luận & Gửi thông báo"
                  : "Ẩn bài viết & Gửi thông báo"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
