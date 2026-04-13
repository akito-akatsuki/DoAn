import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-ig data-[theme=dark]:dark"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-ig bg-background text-foreground transition-colors duration-500">
        {children}
      </body>
    </html>
  );
}
