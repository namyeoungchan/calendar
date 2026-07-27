import type { Metadata, Viewport } from "next";
import AppHeader from "@/components/AppHeader";
import FeedbackProvider from "@/components/ui/FeedbackProvider";
import "./globals.css";

const metadataBase = process.env.PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(metadataBase),
  title: {
    default: "우리 캘린더",
    template: "%s | 우리 캘린더",
  },
  description: "두 사람이 함께 일정과 장소를 기록하는 공유 캘린더",
  applicationName: "우리 캘린더",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#f4f7f8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-[100dvh]">
        <FeedbackProvider>
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6 sm:pt-24">
            {children}
          </main>
        </FeedbackProvider>
      </body>
    </html>
  );
}
