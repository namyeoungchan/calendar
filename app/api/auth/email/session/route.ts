import { NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { findOrCreateFirebaseUser } from "@/lib/data";

interface FirebaseLookupUser {
  localId?: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
}

function webApiKey(): string {
  const value = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!value) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY 환경변수가 필요합니다.");
  return value;
}

async function lookupFirebaseUser(
  idToken: string
): Promise<FirebaseLookupUser & { localId: string }> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      webApiKey()
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!response.ok) throw new Error("Firebase ID 토큰이 올바르지 않습니다.");
  const result = (await response.json()) as { users?: FirebaseLookupUser[] };
  const user = result.users?.[0];
  if (!user?.localId) throw new Error("Firebase 사용자를 찾지 못했습니다.");
  return user as FirebaseLookupUser & { localId: string };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: unknown };
    if (
      typeof body.idToken !== "string" ||
      body.idToken.length < 20 ||
      body.idToken.length > 10_000
    ) {
      return NextResponse.json(
        { error: "Firebase 인증 토큰이 필요합니다." },
        { status: 400 }
      );
    }

    const firebaseUser = await lookupFirebaseUser(body.idToken);
    if (!firebaseUser.email || firebaseUser.emailVerified !== true) {
      return NextResponse.json(
        { error: "이메일 인증을 먼저 완료해주세요." },
        { status: 403 }
      );
    }

    const nickname =
      typeof firebaseUser.displayName === "string" &&
      firebaseUser.displayName.trim()
        ? firebaseUser.displayName.trim().slice(0, 80)
        : firebaseUser.email.split("@")[0].slice(0, 80);
    const account = await findOrCreateFirebaseUser({
      uid: firebaseUser.localId,
      email: firebaseUser.email,
      nickname,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken(account),
      sessionCookieOptions
    );
    return response;
  } catch (error) {
    console.error("Firebase email session error", error);
    return NextResponse.json(
      { error: "로그인 정보를 확인하지 못했습니다. 다시 로그인해주세요." },
      { status: 401 }
    );
  }
}
