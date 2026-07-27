"use client";

interface AuthResponse {
  idToken: string;
  localId: string;
  email: string;
}

interface LookupResponse {
  users?: Array<{ emailVerified?: boolean }>;
}

function apiKey(): string {
  const value = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!value) throw new Error("Firebase 이메일 로그인 환경변수가 설정되지 않았습니다.");
  return value;
}

async function identityRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(apiKey())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = (await response.json().catch(() => null)) as
    | T
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    const failure = data as { error?: { message?: string } } | null;
    const code = failure?.error?.message?.split(" : ")[0];
    const error = new Error(code || "FIREBASE_AUTH_ERROR");
    error.name = "FirebaseEmailAuthError";
    throw error;
  }
  return data as T;
}

export async function createEmailUser(email: string, password: string, displayName: string) {
  const created = await identityRequest<AuthResponse>("signUp", {
    email,
    password,
    returnSecureToken: true,
  });
  try {
    return await identityRequest<AuthResponse>("update", {
      idToken: created.idToken,
      displayName,
      returnSecureToken: true,
    });
  } catch {
    return created;
  }
}

async function mailApiRequest(path: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "이메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
}

export function sendVerificationEmail(idToken: string) {
  return mailApiRequest("/api/auth/email/send-verification", { idToken });
}

export function sendResetEmail(email: string) {
  return mailApiRequest("/api/auth/email/send-reset", { email });
}

export function signInEmailUser(email: string, password: string) {
  return identityRequest<AuthResponse>("signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
}

export async function isEmailVerified(idToken: string): Promise<boolean> {
  const result = await identityRequest<LookupResponse>("lookup", { idToken });
  return result.users?.[0]?.emailVerified === true;
}
