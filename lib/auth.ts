import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConnectionState } from "./data";
import { AccountMissingError } from "./validation";

export const SESSION_COOKIE = "wedding_session";
export const OAUTH_STATE_COOKIE = "kakao_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export interface Session {
  userId: string;
  coupleId: string;
  nickname: string;
  expiresAt: number;
}

export class UnauthorizedError extends Error {
  constructor(message = "로그인이 필요합니다.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ConnectionRequiredError extends Error {
  constructor(message = "파트너 연결을 완료해야 캘린더를 사용할 수 있습니다.") {
    super(message);
    this.name = "ConnectionRequiredError";
  }
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET은 32자 이상이어야 합니다.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function createSessionToken(input: Omit<Session, "expiresAt">): string {
  const session: Session = {
    ...input,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Session;
    if (
      typeof session.userId !== "string" ||
      typeof session.coupleId !== "string" ||
      typeof session.nickname !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireAuthenticatedSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAuthenticatedApiSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireSession(): Promise<Session> {
  const session = await requireAuthenticatedSession();
  const connection = await getConnectionState(session.userId, session.coupleId).catch(
    (error) => {
      if (error instanceof AccountMissingError) redirect("/api/auth/logout");
      throw error;
    }
  );
  if (!connection.connected) redirect("/connect");
  return session;
}

export async function requireApiSession(): Promise<Session> {
  const session = await requireAuthenticatedApiSession();
  const connection = await getConnectionState(session.userId, session.coupleId);
  if (!connection.connected) throw new ConnectionRequiredError();
  return session;
}

export function newOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
