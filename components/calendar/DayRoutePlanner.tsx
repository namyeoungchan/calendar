"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFeedback } from "@/components/ui/FeedbackProvider";
import { fetchJson } from "@/lib/client-api";
import type { CalendarEvent, KakaoPlace, RouteStop } from "@/lib/types";

interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface RouteResult {
  path: RoutePoint[];
  distance: number;
  duration: number;
}

interface RouteCandidate {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  time: string | null;
  source: "event";
}

interface KakaoLatLng {}

interface KakaoLatLngBounds {
  extend(point: KakaoLatLng): void;
}

interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds, padding?: number): void;
}

interface KakaoMapsNamespace {
  load(callback: () => void): void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number }
  ) => KakaoMap;
  Marker: new (options: { map: KakaoMap; position: KakaoLatLng }) => unknown;
  Polyline: new (options: {
    map: KakaoMap;
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: string;
  }) => unknown;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsNamespace };
  }
}

let kakaoLoader: Promise<KakaoMapsNamespace> | null = null;

function loadKakaoMaps(key: string): Promise<KakaoMapsNamespace> {
  if (window.kakao?.maps) {
    return new Promise((resolve) => {
      window.kakao!.maps.load(() => resolve(window.kakao!.maps));
    });
  }

  if (kakaoLoader) return kakaoLoader;

  kakaoLoader = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-calendar-kakao-map="true"]'
    );
    const script = existingScript ?? document.createElement("script");

    const finish = () => {
      if (!window.kakao?.maps) {
        reject(new Error("카카오 지도 SDK를 불러오지 못했습니다."));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao!.maps));
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("카카오 지도 SDK 요청에 실패했습니다.")),
      { once: true }
    );

    if (!existingScript) {
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
        key
      )}&autoload=false`;
      script.async = true;
      script.dataset.calendarKakaoMap = "true";
      document.head.appendChild(script);
    } else if (window.kakao?.maps) {
      finish();
    }
  });

  return kakaoLoader;
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function kakaoMapUrl(stop: RouteStop): string {
  return `https://map.kakao.com/link/map/${encodeURIComponent(stop.name)},${stop.latitude},${stop.longitude}`;
}

function kakaoRouteUrl(stops: RouteStop[]): string {
  const points = stops
    .slice(0, 7)
    .map(
      (stop) =>
        `${encodeURIComponent(stop.name)},${stop.latitude},${stop.longitude}`
    );
  return `https://map.kakao.com/link/by/car/${points.join("/")}`;
}

function kakaoTransitUrl(from: RouteStop, to: RouteStop): string {
  const point = (stop: RouteStop) =>
    `${encodeURIComponent(stop.name)},${stop.latitude},${stop.longitude}`;
  return `https://map.kakao.com/link/by/traffic/${point(from)}/${point(to)}`;
}

function durationLabel(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}

export default function DayRoutePlanner({
  date,
  events,
}: {
  date: string;
  events: CalendarEvent[];
}) {
  const { toast } = useFeedback();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY ?? "";
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [path, setPath] = useState<RoutePoint[]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    duration: number;
  } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [routing, setRouting] = useState(false);
  const [mapError, setMapError] = useState("");

  const candidates = useMemo<RouteCandidate[]>(() => {
    return events
      .filter(
        (event) =>
          event.date === date &&
          (Boolean(event.location) ||
            (event.latitude != null && event.longitude != null))
      )
      .map((event) => ({
        id: `event-${event.id}`,
        name: event.placeName || event.title,
        address: event.location || "",
        latitude: event.latitude,
        longitude: event.longitude,
        time: event.time,
        source: "event" as const,
      }))
      .sort((a, b) => {
        const timeOrder = (a.time || "99:99").localeCompare(b.time || "99:99");
        return timeOrder || a.name.localeCompare(b.name, "ko");
      });
  }, [date, events]);

  useEffect(() => {
    const controller = new AbortController();
    setPath([]);
    setRouteInfo(null);
    setMapError("");

    if (candidates.length === 0) {
      setStops([]);
      setResolving(false);
      return () => controller.abort();
    }

    setResolving(true);
    setStops([]);

    const resolveStops = async () => {
      const resolved = await Promise.all(
        candidates.map(async (candidate): Promise<RouteStop | null> => {
          if (candidate.latitude != null && candidate.longitude != null) {
            return {
              ...candidate,
              latitude: candidate.latitude,
              longitude: candidate.longitude,
            };
          }

          try {
            const query = `${candidate.name} ${candidate.address}`.trim();
            const places = await fetchJson<KakaoPlace[]>(
              `/api/maps/places?q=${encodeURIComponent(query)}`,
              { signal: controller.signal }
            );
            const place = places[0];
            if (!place) return null;
            return {
              ...candidate,
              name: place.name || candidate.name,
              address:
                place.roadAddress || place.address || candidate.address,
              latitude: place.latitude,
              longitude: place.longitude,
            };
          } catch {
            return null;
          }
        })
      );

      if (controller.signal.aborted) return;
      setStops(resolved.filter((item): item is RouteStop => Boolean(item)));
      setResolving(false);
    };

    void resolveStops();
    return () => controller.abort();
  }, [candidates]);

  useEffect(() => {
    const container = mapRef.current;
    if (!mapKey || !container || stops.length === 0) return;

    let cancelled = false;
    setMapError("");

    void loadKakaoMaps(mapKey)
      .then((maps) => {
        if (cancelled) return;
        container.innerHTML = "";

        const stopPoints = stops.map(
          (stop) => new maps.LatLng(stop.latitude, stop.longitude)
        );
        const map = new maps.Map(container, {
          center: stopPoints[0],
          level: 5,
        });
        const bounds = new maps.LatLngBounds();

        stopPoints.forEach((point) => {
          bounds.extend(point);
          new maps.Marker({ map, position: point });
        });

        const routePoints = (path.length > 1 ? path : stops).map(
          (item) => new maps.LatLng(item.latitude, item.longitude)
        );
        if (routePoints.length > 1) {
          new maps.Polyline({
            map,
            path: routePoints,
            strokeWeight: 5,
            strokeColor: "#334f78",
            strokeOpacity: 0.82,
            strokeStyle: "solid",
          });
        }

        map.setBounds(bounds, 48);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setMapError(
            loadError instanceof Error
              ? loadError.message
              : "지도를 불러오지 못했습니다."
          );
        }
      });

    return () => {
      cancelled = true;
      container.innerHTML = "";
    };
  }, [mapKey, path, stops]);

  const reorder = (index: number, nextIndex: number) => {
    setStops((current) => move(current, index, nextIndex));
    setPath([]);
    setRouteInfo(null);
  };

  const calculateRoute = async () => {
    if (stops.length < 2 || routing) return;

    setRouting(true);
    try {
      const included = stops.slice(0, 7);
      const result = await fetchJson<RouteResult>("/api/maps/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: included.map(({ latitude, longitude }) => ({
            latitude,
            longitude,
          })),
        }),
      });
      setPath(result.path);
      setRouteInfo({
        distance: result.distance,
        duration: result.duration,
      });

      if (stops.length > 7) {
        toast({
          tone: "info",
          title: "앞의 7개 장소로 동선을 계산했습니다",
          description: "한 경로에 넣을 수 있는 장소는 최대 7곳입니다.",
        });
      }
    } catch (routeError) {
      setPath([]);
      setRouteInfo(null);
      toast({
        tone: "error",
        title: "자동차 동선을 계산하지 못했습니다",
        description:
          routeError instanceof Error
            ? routeError.message
            : "카카오 길찾기 설정을 확인해주세요.",
      });
    } finally {
      setRouting(false);
    }
  };

  if (candidates.length === 0) {
    return (
      <section className="surface-card p-5 sm:p-6" aria-labelledby="day-route-empty-title">
        <p className="section-kicker">일정 장소 동선</p>
        <h2
          id="day-route-empty-title"
          className="mt-2 text-xl font-bold tracking-tight text-stone-900"
        >
          이 날짜에는 장소가 등록된 일정이 없습니다
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
          일정에 장소를 추가하면 방문 순서를 바꾸고 자동차 동선을 계산할 수 있습니다.
        </p>
      </section>
    );
  }

  const unresolvedCount = candidates.length - stops.length;

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="day-route-title">
      <div className="border-b border-rule p-5 sm:p-6">
        <p className="section-kicker">일정 장소 동선</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="day-route-title"
              className="text-xl font-bold tracking-tight text-stone-900"
            >
              {date} 방문 순서
            </h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              일정 시간순으로 정렬했습니다. 화살표로 방문 순서를 바꿀 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {stops.length >= 2 && (
              <a
                href={kakaoRouteUrl(stops)}
                target="_blank"
                rel="noreferrer"
                className="button-secondary whitespace-nowrap"
              >
                카카오맵에서 열기
              </a>
            )}
            <button
              type="button"
              onClick={() => void calculateRoute()}
              disabled={stops.length < 2 || routing || resolving}
              className="button-primary whitespace-nowrap"
            >
              {routing ? "동선 계산 중" : "자동차 동선 계산"}
            </button>
          </div>
        </div>

        {routeInfo && (
          <p className="mt-3 text-sm font-semibold text-sky-ink" role="status">
            총 {(routeInfo.distance / 1_000).toFixed(1)}km, 예상{" "}
            {durationLabel(routeInfo.duration)}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(18rem,0.82fr)_1.18fr]">
        <div className="p-3 sm:p-4">
          {resolving && (
            <div className="space-y-3 p-2" aria-live="polite" aria-label="장소 좌표 확인 중">
              {[0, 1].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="skeleton h-8 w-8 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!resolving && (
            <ol className="divide-y divide-rule-soft">
              {stops.map((stop, index) => (
                <li key={stop.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-ink">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-stone-900">
                      {stop.time ? `${stop.time} ` : ""}
                      {stop.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {stop.address || "주소 정보 없음"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      <a
                        href={kakaoMapUrl(stop)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-8 items-center text-xs font-semibold text-sky-ink underline underline-offset-2"
                      >
                        장소 보기
                      </a>
                      {index < stops.length - 1 && (
                        <a
                          href={kakaoTransitUrl(stop, stops[index + 1])}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-8 items-center text-xs font-semibold text-meadow-ink underline underline-offset-2"
                        >
                          다음 장소까지 대중교통
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-1 lg:grid-cols-1">
                    <button
                      type="button"
                      onClick={() => reorder(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`${stop.name} 순서 올리기`}
                      className="button-ghost h-9 min-h-9 px-2.5 text-base"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => reorder(index, index + 1)}
                      disabled={index === stops.length - 1}
                      aria-label={`${stop.name} 순서 내리기`}
                      className="button-ghost h-9 min-h-9 px-2.5 text-base"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {!resolving && unresolvedCount > 0 && (
            <p className="mt-3 rounded-xl bg-gold-100 px-3 py-2.5 text-xs font-medium leading-5 text-gold-700">
              검색되지 않은 장소 {unresolvedCount}곳은 동선에서 제외했습니다. 일정의 장소를 다시
              검색해 선택해주세요.
            </p>
          )}
        </div>

        <div className="min-h-[20rem] border-t border-rule bg-stone-100 lg:border-l lg:border-t-0">
          {mapKey && !mapError && stops.length > 0 ? (
            <div
              ref={mapRef}
              className="h-full min-h-[20rem] w-full"
              aria-label={`${date} 일정 장소 지도`}
            />
          ) : (
            <div className="flex min-h-[20rem] items-center justify-center p-6 text-center">
              <div>
                <p className="text-sm font-bold text-stone-800">
                  {stops.length === 0
                    ? "지도에 표시할 장소를 찾지 못했습니다"
                    : "지도 표시 설정이 필요합니다"}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-stone-500">
                  {stops.length === 0
                    ? "일정에서 장소를 다시 검색해 선택해주세요."
                    : mapError ||
                      "NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY를 등록하면 이곳에 동선 지도가 표시됩니다. 장소 링크와 길찾기는 계속 사용할 수 있습니다."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
