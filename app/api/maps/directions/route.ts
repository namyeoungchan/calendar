import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { InputError } from "@/lib/validation";

interface PointInput {
  latitude: number;
  longitude: number;
}

interface KakaoDirectionsResponse {
  routes?: Array<{
    result_code?: number;
    result_msg?: string;
    summary?: { distance?: number; duration?: number };
    sections?: Array<{
      roads?: Array<{ vertexes?: number[] }>;
    }>;
  }>;
}

function point(value: unknown): PointInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("경로 좌표가 올바르지 않습니다.");
  }
  const row = value as Record<string, unknown>;
  const latitude = row.latitude;
  const longitude = row.longitude;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new InputError("경로 좌표가 올바르지 않습니다.");
  }
  return { latitude, longitude };
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession();
    const body = (await request.json()) as { points?: unknown };
    if (!Array.isArray(body.points)) {
      throw new InputError("경로 장소 목록이 올바르지 않습니다.");
    }
    if (body.points.length < 2) {
      throw new InputError("경로를 계산하려면 장소가 두 곳 이상 필요합니다.");
    }
    if (body.points.length > 7) {
      throw new InputError("한 경로에는 장소를 최대 7곳까지 넣을 수 있습니다.");
    }
    const points = body.points.map(point);
    const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "카카오 길찾기 환경변수가 설정되지 않았습니다." },
        { status: 503 }
      );
    }

    const origin = points[0];
    const destination = points.at(-1)!;
    const waypoints = points.slice(1, -1);
    const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
    url.searchParams.set("origin", `${origin.longitude},${origin.latitude}`);
    url.searchParams.set(
      "destination",
      `${destination.longitude},${destination.latitude}`
    );
    if (waypoints.length > 0) {
      url.searchParams.set(
        "waypoints",
        waypoints.map((item) => `${item.longitude},${item.latitude}`).join("|")
      );
    }
    url.searchParams.set("priority", "RECOMMEND");
    url.searchParams.set("car_type", "1");

    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | KakaoDirectionsResponse
      | null;
    const route = payload?.routes?.[0];
    if (!response.ok || !route || route.result_code !== 0) {
      console.error(
        "Kakao Mobility directions error",
        response.status,
        route?.result_code,
        route?.result_msg
      );
      return NextResponse.json(
        { error: "자동차 경로를 계산하지 못했습니다." },
        { status: 502 }
      );
    }

    const path = (route.sections ?? []).flatMap((section) =>
      (section.roads ?? []).flatMap((road) => {
        const vertices = road.vertexes ?? [];
        const result: Array<{ latitude: number; longitude: number }> = [];
        for (let index = 0; index + 1 < vertices.length; index += 2) {
          result.push({
            longitude: vertices[index],
            latitude: vertices[index + 1],
          });
        }
        return result;
      })
    );
    return NextResponse.json({
      path,
      distance: route.summary?.distance ?? 0,
      duration: route.summary?.duration ?? 0,
    });
  } catch (error) {
    return apiError(error);
  }
}
