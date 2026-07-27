export interface KakaoProfile {
  id: string;
  nickname: string;
  email: string | null;
  profileImage: string | null;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function normalizeAppUrl(value: string, source: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(trimmed);
  const candidate = hasProtocol ? trimmed : `${local ? "http" : "https"}://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    throw new Error(`${source}에 올바른 앱 URL을 설정해주세요.`);
  }
}

export function appUrl(): string {
  const configured: Array<[string, string | undefined]> = [
    ["APP_URL", process.env.APP_URL],
    ["PUBLIC_APP_URL", process.env.PUBLIC_APP_URL],
    ["VERCEL_PROJECT_PRODUCTION_URL", process.env.VERCEL_PROJECT_PRODUCTION_URL],
  ];
  for (const [name, value] of configured) {
    if (value?.trim()) return normalizeAppUrl(value, name);
  }
  return "http://localhost:3000";
}

export function publicAppUrl(): string {
  return appUrl();
}

export function kakaoRedirectUri(): string {
  return `${appUrl()}/api/auth/kakao/callback`;
}

export function kakaoAuthorizeUrl(state: string): string {
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", required("KAKAO_REST_API_KEY"));
  url.searchParams.set("redirect_uri", kakaoRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeKakaoCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: required("KAKAO_REST_API_KEY"),
    redirect_uri: kakaoRedirectUri(),
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET?.trim()) {
    body.set("client_secret", process.env.KAKAO_CLIENT_SECRET.trim());
  }

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || "카카오 액세스 토큰을 받지 못했습니다.");
  }
  return data.access_token;
}

export async function getKakaoProfile(accessToken: string): Promise<KakaoProfile> {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json().catch(() => null)) as {
    id?: number;
    properties?: { nickname?: string; profile_image?: string };
    kakao_account?: {
      email?: string;
      profile?: { nickname?: string; profile_image_url?: string };
    };
  } | null;
  if (!response.ok || data?.id == null) {
    throw new Error("카카오 사용자 정보를 불러오지 못했습니다.");
  }

  const profile = data.kakao_account?.profile;
  return {
    id: String(data.id),
    nickname: profile?.nickname || data.properties?.nickname || "카카오 사용자",
    email: data.kakao_account?.email ?? null,
    profileImage: profile?.profile_image_url || data.properties?.profile_image || null,
  };
}
