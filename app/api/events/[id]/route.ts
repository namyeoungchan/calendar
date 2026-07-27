import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { deleteEvent, updateEvent } from "@/lib/data";
import { parseEventInput, parseId } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireApiSession();
    const event = await updateEvent(
      session.coupleId,
      parseId(id),
      parseEventInput(await request.json())
    );
    if (!event) {
      return NextResponse.json({ error: "일정을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireApiSession();
    if (!(await deleteEvent(session.coupleId, parseId(id)))) {
      return NextResponse.json({ error: "일정을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
