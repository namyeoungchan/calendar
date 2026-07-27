import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import {
  createSessionToken,
  requireAuthenticatedApiSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  connectPartner,
  disconnectSoloTestPartner,
  getConnectionState,
} from "@/lib/data";
import { parseUserCode } from "@/lib/validation";

export async function GET() {
  try {
    const session = await requireAuthenticatedApiSession();
    return NextResponse.json(
      await getConnectionState(session.userId, session.coupleId)
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedApiSession();
    const userCode = parseUserCode(await request.json());
    const result = await connectPartner(session.userId, session.coupleId, userCode);
    const response = NextResponse.json(result.state);
    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken({
        userId: session.userId,
        coupleId: result.coupleId,
        nickname: session.nickname,
      }),
      sessionCookieOptions
    );
    return response;
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  try {
    const session = await requireAuthenticatedApiSession();
    return NextResponse.json(
      await disconnectSoloTestPartner(session.userId, session.coupleId)
    );
  } catch (error) {
    return apiError(error);
  }
}
