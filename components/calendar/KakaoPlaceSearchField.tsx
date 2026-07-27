"use client";

import { useEffect, useId, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { KakaoPlace } from "@/lib/types";

interface KakaoPlaceSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: KakaoPlace) => void;
  endpoint?: string;
}

export default function KakaoPlaceSearchField({
  value,
  onChange,
  onSelect,
  endpoint = "/api/maps/places",
}: KakaoPlaceSearchFieldProps) {
  const listboxId = useId();
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2 || query === selectedValue) {
      setResults([]);
      setLoading(false);
      setSearchedQuery("");
      setError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      setSearchedQuery("");

      try {
        const places = await fetchJson<KakaoPlace[]>(
          `${endpoint}?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        setResults(places);
        setSearchedQuery(query);
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        setResults([]);
        setError(
          searchError instanceof Error
            ? searchError.message
            : "장소를 검색하지 못했습니다. 잠시 후 다시 시도해주세요."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, selectedValue, value]);

  const hasResults = !loading && results.length > 0;
  const hasNoResults =
    !loading &&
    !error &&
    searchedQuery.length > 0 &&
    searchedQuery === value.trim() &&
    results.length === 0;

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => {
          setSelectedValue("");
          setSearchedQuery("");
          setError("");
          onChange(event.target.value);
        }}
        placeholder="장소명이나 주소를 검색하세요"
        className="field-input pr-20"
        maxLength={300}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={hasResults}
        aria-describedby={error || hasNoResults ? `${listboxId}-status` : undefined}
      />

      {loading && (
        <span
          className="pointer-events-none absolute right-3 top-3.5 text-xs font-medium text-stone-500"
          role="status"
        >
          검색 중
        </span>
      )}

      {hasResults && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="장소 검색 결과"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-rule bg-paper-2 p-1.5 shadow-xl"
        >
          {results.map((place) => {
            const address = place.roadAddress || place.address;
            return (
              <li key={place.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    const nextValue = address || place.name;
                    setSelectedValue(nextValue);
                    setSearchedQuery("");
                    setResults([]);
                    onSelect(place);
                  }}
                  className="block min-h-11 w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-stone-100 focus-visible:bg-stone-100"
                >
                  <span className="block text-sm font-semibold text-stone-900">{place.name}</span>
                  {address && (
                    <span className="mt-0.5 block text-xs font-normal leading-5 text-stone-500">
                      {address}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(error || hasNoResults) && (
        <p
          id={`${listboxId}-status`}
          role={error ? "alert" : "status"}
          className={`mt-1.5 text-xs font-medium leading-5 ${
            error ? "text-red-700" : "text-stone-500"
          }`}
        >
          {error || "검색 결과가 없습니다. 다른 장소명이나 주소로 검색해보세요."}
        </p>
      )}
    </div>
  );
}
