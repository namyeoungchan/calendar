import type { KakaoPlace } from "./types";

interface KakaoLocalDocument {
  id?: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
  place_url?: string;
  phone?: string;
  road_address?: { address_name?: string; building_name?: string } | null;
}

interface KakaoLocalResponse {
  documents?: KakaoLocalDocument[];
  message?: string;
}

export class KakaoLocalConfigurationError extends Error {
  constructor() {
    super("카카오 REST API 키가 설정되지 않았거나 장소 검색 권한이 없습니다.");
    this.name = "KakaoLocalConfigurationError";
  }
}

function toPlace(document: KakaoLocalDocument, index: number): KakaoPlace | null {
  const latitude = Number(document.y);
  const longitude = Number(document.x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = document.address_name?.trim() ?? "";
  const roadAddress =
    document.road_address_name?.trim() ||
    document.road_address?.address_name?.trim() ||
    "";
  return {
    id: document.id || `${longitude}-${latitude}-${index}`,
    name:
      document.place_name?.trim() ||
      document.road_address?.building_name?.trim() ||
      roadAddress ||
      address,
    address,
    roadAddress,
    latitude,
    longitude,
    url: document.place_url?.trim() ?? "",
    phone: document.phone?.trim() ?? "",
  };
}

async function kakaoSearch(
  endpoint: string,
  query: string,
  apiKey: string
): Promise<KakaoPlace[]> {
  const url = new URL(endpoint);
  url.searchParams.set("query", query);
  url.searchParams.set("size", "8");

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const payload = (await response.json().catch(() => null)) as KakaoLocalResponse | null;
  if (!response.ok) {
    console.error("Kakao Local API error", response.status, payload?.message);
    if (response.status === 401 || response.status === 403) {
      throw new KakaoLocalConfigurationError();
    }
    throw new Error("카카오 장소 검색에 실패했습니다.");
  }

  return (payload?.documents ?? []).flatMap((document, index) => {
    const place = toPlace(document, index);
    return place ? [place] : [];
  });
}

export async function searchKakaoPlaces(query: string): Promise<KakaoPlace[]> {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) throw new KakaoLocalConfigurationError();

  const keyword = await kakaoSearch(
    "https://dapi.kakao.com/v2/local/search/keyword.json",
    query,
    apiKey
  );
  if (keyword.length > 0) return keyword;
  return kakaoSearch("https://dapi.kakao.com/v2/local/search/address.json", query, apiKey);
}
