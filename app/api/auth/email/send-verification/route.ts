import { NextResponse } from "next/server";
import { appUrl } from "@/lib/kakao";

function webApiKey(): string {
  const value = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!value) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY 환경변수가 필요합니다.");
  return value;
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

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(
        webApiKey()
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "VERIFY_EMAIL",
          idToken: body.idToken,
          continueUrl: `${appUrl()}/login?verified=1`,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!response.ok) throw new Error("Firebase 인증 메일 요청에 실패했습니다.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Firebase verification email error", error);
    return NextResponse.json(
      { error: "인증 메일을 보내지 못했습니다." },
      { status: 502 }
    );
  }
}
