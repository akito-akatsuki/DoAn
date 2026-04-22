"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AuthPage() {
  const [view, setView] = useState<"login" | "register" | "forgot" | "update">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const search = window.location.search;
    const hash = window.location.hash;
    if (search.includes("view=register")) setView("register");
    // Khi người dùng bấm vào link khôi phục từ email, Supabase sẽ gắn type=recovery trên URL
    if (search.includes("view=update") || hash.includes("type=recovery"))
      setView("update");
  }, []);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (view === "login") {
      // === LOGIN LOGIC ===
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error(error.message || "Email hoặc mật khẩu không đúng.");
      } else {
        toast.success("Đăng nhập thành công!");
        window.location.href = "/"; // Force reload để mount lại toàn bộ app và xóa Next.js Cache
      }
    } else if (view === "register") {
      // === SIGN UP LOGIC ===
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        toast.error(error.message || "Không thể tạo tài khoản.");
      } else {
        if (data.session) {
          // Đăng ký thành công và Confirm Email đã tắt -> tự động đăng nhập luôn
          toast.success("Đăng ký thành công!");
          window.location.href = "/";
        } else {
          // Đăng ký thành công nhưng Confirm Email vẫn bật -> Báo người dùng check email
          toast.success(
            "Đăng ký thành công! Vui lòng kiểm tra email để xác thực.",
          );
          setView("login");
        }
      }
    } else if (view === "forgot") {
      // === FORGOT PASSWORD LOGIC ===
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?view=update`,
      });
      if (error) {
        toast.error(error.message || "Không thể gửi email khôi phục.");
      } else {
        toast.success("Đã gửi email khôi phục! Vui lòng kiểm tra hộp thư.");
        setView("login");
      }
    } else if (view === "update") {
      // === UPDATE PASSWORD LOGIC ===
      const { error } = await supabase.auth.updateUser({
        password: password,
      });
      if (error) {
        toast.error(error.message || "Không thể cập nhật mật khẩu.");
      } else {
        toast.success("Cập nhật mật khẩu thành công!");
        window.location.href = "/";
      }
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });
    if (error) {
      toast.error(error.message || "Đăng nhập với Google thất bại.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-4 transition-colors duration-500">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 shadow-xl rounded-xl p-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-6">
            {view === "login" && "Đăng nhập"}
            {view === "register" && "Đăng ký"}
            {view === "forgot" && "Khôi phục mật khẩu"}
            {view === "update" && "Tạo mật khẩu mới"}
          </h2>

          <form onSubmit={handleAuthAction}>
            {view !== "update" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 dark:border-neutral-700 shadow-inner p-2.5 rounded-lg outline-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#202020] text-gray-900 dark:text-gray-100 transition-colors"
                />
              </div>
            )}
            {view !== "forgot" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  {view === "update" ? "Mật khẩu mới" : "Mật khẩu"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full border border-gray-300 dark:border-neutral-700 shadow-inner p-2.5 rounded-lg outline-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#202020] text-gray-900 dark:text-gray-100 transition-colors"
                />
              </div>
            )}

            {view === "login" && (
              <div className="flex justify-end mb-4 mt-[-4px]">
                <button
                  type="button"
                  onClick={() => setView("forgot")}
                  className="text-sm font-medium text-blue-500 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition disabled:opacity-50"
            >
              {loading
                ? "Đang xử lý..."
                : view === "login"
                  ? "Đăng nhập"
                  : view === "register"
                    ? "Đăng ký"
                    : view === "forgot"
                      ? "Gửi email khôi phục"
                      : "Cập nhật mật khẩu"}
            </button>
          </form>

          {(view === "login" || view === "register") && (
            <>
              <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-sm">
                  HOẶC
                </span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
              </div>

              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-neutral-700 py-2.5 rounded-lg font-medium text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
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
            </>
          )}

          <p className="text-center text-sm text-gray-500 mt-8">
            {view === "login"
              ? "Chưa có tài khoản?"
              : view === "register"
                ? "Đã có tài khoản?"
                : "Quay lại"}
            <button
              type="button"
              onClick={() => setView(view === "login" ? "register" : "login")}
              className="font-semibold text-blue-500 hover:underline ml-1"
            >
              {view === "login" ? "Đăng ký ngay" : "Đăng nhập"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
