import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Navbar from "@/components/navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InstaMini",
  description: "Social network like Instagram",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value || "light";
  const isDark = theme === "dark";

  return (
    <html
      lang="en"
      className={`h-full antialiased font-ig ${isDark ? "dark" : ""}`}
      data-theme={isDark ? "dark" : "light"}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-ig bg-background text-foreground transition-colors duration-500">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
