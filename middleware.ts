import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "wedding_session";
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/kakao",
  "/api/auth/email/",
  "/api/auth/logout",
  "/icons/",
  "/favicon",
  "/manifest",
  "/robots.txt",
  "/sitemap.xml",
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath)) ||
    /\.[A-Za-z0-9]+$/.test(path)
  ) {
    return NextResponse.next();
  }
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
