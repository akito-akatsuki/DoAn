import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Giả định bạn có file CSS global này
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers"; // Import cookies từ Next.js
import Navbar from "@/components/navbar";
import GlobalConfirm from "@/components/GlobalConfirm";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Apex",
  description: "Mạng xã hội Apex",
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
        <Toaster
          position="bottom-left"
          containerStyle={{ zIndex: 999999 }}
          toastOptions={{
            className:
              "animate-in slide-in-from-left-8 fade-in duration-1000 !bg-white dark:!bg-[#333333] !text-gray-900 dark:!text-white border border-gray-200 dark:border-neutral-700 shadow-lg",
            duration: 4000,
            style: {
              borderRadius: "12px",
              padding: "12px 16px",
            },
          }}
        />
        <Navbar user={null} /> <GlobalConfirm />
        {/* Navbar được đặt ở đây để hiển thị trên mọi trang */}
        {children}
      </body>
    </html>
  );
}
