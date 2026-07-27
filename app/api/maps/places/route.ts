import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import {
  KakaoLocalConfigurationError,
  searchKakaoPlaces,
} from "@/lib/kakao-places";
import { InputError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) {
      throw new InputError("장소 검색어를 두 글자 이상 입력해주세요.");
    }
    if (query.length > 200) {
      throw new InputError("장소 검색어가 너무 깁니다.");
    }
    return NextResponse.json(await searchKakaoPlaces(query));
  } catch (error) {
    if (error instanceof KakaoLocalConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return apiError(error);
  }
}
