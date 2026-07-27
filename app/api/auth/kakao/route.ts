import { NextResponse } from "next/server";
import {
  newOAuthState,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth";
import { appUrl, kakaoAuthorizeUrl } from "@/lib/kakao";

export async function GET() {
  try {
    const state = newOAuthState();
    const response = NextResponse.redirect(kakaoAuthorizeUrl(state));
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/login?error=config", appUrl()));
  }
}
