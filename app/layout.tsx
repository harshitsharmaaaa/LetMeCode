import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "LeetCode",
  description: "A coding platform powered by BlackBox",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
            <Link href="/" className="font-bold text-lg">
              LeetCode
            </Link>
            <Link
              href="/problems"
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              Problems
            </Link>
            <Link
              href="/submissions"
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              Submissions
            </Link>
          </div>
        </nav>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
