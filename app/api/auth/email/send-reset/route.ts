import { NextResponse } from "next/server";
import { appUrl } from "@/lib/kakao";

function webApiKey(): string {
  const value = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!value) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY 환경변수가 필요합니다.");
  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (
      !email ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "올바른 이메일 주소를 입력해주세요." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(
        webApiKey()
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email,
          continueUrl: `${appUrl()}/login?reset=1`,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!response.ok) throw new Error("Firebase 비밀번호 재설정 요청에 실패했습니다.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Firebase password reset email error", error);
    return NextResponse.json(
      { error: "비밀번호 재설정 메일을 보내지 못했습니다." },
      { status: 502 }
    );
  }
}
