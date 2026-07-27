import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { createEvent, listEvents } from "@/lib/data";
import { parseEventInput } from "@/lib/validation";

export async function GET() {
  try {
    const session = await requireApiSession();
    return NextResponse.json(await listEvents(session.coupleId));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const input = parseEventInput(await request.json());
    return NextResponse.json(await createEvent(session.coupleId, input), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
