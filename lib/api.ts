import { NextResponse } from "next/server";
import {
  ConnectionRequiredError,
  UnauthorizedError,
} from "./auth";
import { AccountMissingError, InputError } from "./validation";

export function apiError(error: unknown): NextResponse {
  if (error instanceof AccountMissingError || error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof InputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ConnectionRequiredError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json(
    { error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." },
    { status: 500 }
  );
}
