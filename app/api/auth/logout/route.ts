import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { appUrl } from "@/lib/kakao";

function clearSessionAndRedirect(): NextResponse {
  const response = NextResponse.redirect(new URL("/login", appUrl()), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function POST() {
  return clearSessionAndRedirect();
}

export async function GET() {
  return clearSessionAndRedirect();
}
