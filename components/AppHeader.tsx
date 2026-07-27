"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

function CalendarMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
      aria-hidden="true"
    >
      <rect x="4.5" y="6.5" width="23" height="21" rx="5" />
      <path d="M10 4.5v5M22 4.5v5M4.5 13h23" />
      <path d="m11.5 20 3 3 6-7" />
    </svg>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  if (pathname.startsWith("/login") || pathname.startsWith("/connect")) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-rule bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="우리 캘린더 홈">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white">
            <CalendarMark />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight text-stone-900">우리 캘린더</span>
            <span className="hidden text-[11px] font-medium text-stone-500 sm:block">
              둘이 함께 기록하는 일정
            </span>
          </span>
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
