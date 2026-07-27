"use client";

import { useState, type FormEvent } from "react";

export default function LogoutButton({ className = "button-ghost text-sm" }: { className?: string }) {
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/login");
  };

  return (
    <form onSubmit={logout}>
      <button type="submit" disabled={loggingOut} className={className}>
        {loggingOut ? "로그아웃 중" : "로그아웃"}
      </button>
    </form>
  );
}
