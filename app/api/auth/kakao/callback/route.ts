import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { findOrCreateKakaoUser } from "@/lib/data";
import {
  appUrl,
  exchangeKakaoCode,
  getKakaoProfile,
} from "@/lib/kakao";

export async function GET(request: NextRequest) {
  const baseUrl = appUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (oauthError) {
    return NextResponse.redirect(new URL("/login?error=denied", baseUrl));
  }
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=state", baseUrl));
  }

  try {
    const accessToken = await exchangeKakaoCode(code);
    const profile = await getKakaoProfile(accessToken);
    const account = await findOrCreateKakaoUser(profile);
    const response = NextResponse.redirect(new URL("/", baseUrl));
    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken(account),
      sessionCookieOptions
    );
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Kakao OAuth callback error", error);
    const response = NextResponse.redirect(
      new URL("/login?error=failed", baseUrl)
    );
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
