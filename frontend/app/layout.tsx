import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Giả định bạn có file CSS global này
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers"; // Import cookies từ Next.js
import Navbar from "@/components/navbar";
import GlobalConfirm from "@/components/GlobalConfirm";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InstaMini",
  description: "Một ứng dụng mạng xã hội nhỏ gọn.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value || "light"; // Lấy theme từ cookie, mặc định là 'light'

  return (
    <html lang="vi" className={theme === "dark" ? "dark" : ""}>
      <body className={inter.className}>
        {/* Toaster sẽ hiển thị các thông báo toast ở đây */}
        <Toaster position="top-right" containerStyle={{ zIndex: 999999 }} />
        <Navbar user={null} /> <GlobalConfirm />
        {/* Navbar được đặt ở đây để hiển thị trên mọi trang */}
        {children}
      </body>
    </html>
  );
}
