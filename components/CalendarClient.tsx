"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFeedback } from "@/components/ui/FeedbackProvider";
import DayRoutePlanner from "@/components/calendar/DayRoutePlanner";
import DayShareButton from "@/components/calendar/DayShareButton";
import KakaoPlaceSearchField from "@/components/calendar/KakaoPlaceSearchField";
import { fetchJson } from "@/lib/client-api";
import type { CalendarEvent, KakaoPlace, Owner } from "@/lib/types";
import { OWNER_LABELS } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface EventForm {
  title: string;
  time: string;
  owner: Owner;
  memo: string;
  location: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  placeUrl: string;
}

const OWNER_STYLES: Record<
  Owner,
  { marker: string; border: string; badge: string }
> = {
  groom: {
    marker: "bg-groom",
    border: "border-groom",
    badge: "bg-groom-soft text-groom-ink",
  },
  bride: {
    marker: "bg-rose-400",
    border: "border-rose-400",
    badge: "bg-rose-100 text-rose-800",
  },
  both: {
    marker: "bg-gold-400",
    border: "border-gold-400",
    badge: "bg-gold-100 text-gold-700",
  },
};

function emptyForm(): EventForm {
  return {
    title: "",
    time: "",
    owner: "both",
    memo: "",
    location: "",
    placeName: "",
    latitude: null,
    longitude: null,
    placeUrl: "",
  };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayString(): string {
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function isValidDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function dateParts(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  return [year, month, day];
}

function selectedDateLabel(date: string): string {
  const [year, month, day] = dateParts(date);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${month}월 ${day}일 ${weekday}요일`;
}

function eventSort(a: CalendarEvent, b: CalendarEvent): number {
  const timeOrder = (a.time || "99:99").localeCompare(b.time || "99:99");
  return timeOrder || a.title.localeCompare(b.title, "ko");
}

function eventMapUrl(event: CalendarEvent): string {
  if (event.placeUrl) return event.placeUrl;
  if (event.latitude != null && event.longitude != null) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(
      event.placeName || event.title
    )},${event.latitude},${event.longitude}`;
  }
  return `https://map.kakao.com/?q=${encodeURIComponent(event.location || event.title)}`;
}

export default function CalendarClient({
  initialDate,
  publicBaseUrl,
}: {
  initialDate?: string;
  publicBaseUrl: string;
}) {
  const { toast, confirm } = useFeedback();
  const today = useMemo(todayString, []);
  const startingDate = isValidDate(initialDate) ? initialDate : today;
  const [startingYear, startingMonth] = dateParts(startingDate);

  const [year, setYear] = useState(startingYear);
  const [month, setMonth] = useState(startingMonth);
  const [selected, setSelected] = useState(startingDate);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const rows = await fetchJson<CalendarEvent[]>("/api/events");
      setEvents(rows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.";
      setLoadError(message);
      toast({
        tone: "error",
        title: "일정을 불러오지 못했습니다",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isValidDate(initialDate)) return;
    const [nextYear, nextMonth] = dateParts(initialDate);
    setYear(nextYear);
    setMonth(nextMonth);
    setSelected(initialDate);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  }, [initialDate]);

  const markers = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const current = map.get(event.date) ?? [];
      current.push(event);
      map.set(event.date, current);
    }
    for (const rows of map.values()) rows.sort(eventSort);
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const minimumCellCount = firstDay + daysInMonth;
    const cellCount = Math.ceil(minimumCellCount / 7) * 7;

    return Array.from({ length: cellCount }, (_, index) => {
      const day = index - firstDay + 1;
      if (day < 1 || day > daysInMonth) return null;
      return formatDate(year, month, day);
    });
  }, [month, year]);

  const dayEvents = useMemo(
    () => events.filter((event) => event.date === selected).sort(eventSort),
    [events, selected]
  );

  const dayShareLines = useMemo(
    () =>
      dayEvents.map((event) => {
        const place = event.placeName || event.location;
        const details = [
          event.time,
          OWNER_LABELS[event.owner],
          place || null,
        ].filter((item): item is string => Boolean(item));
        return details.length > 0
          ? `${event.title} (${details.join(", ")})`
          : event.title;
      }),
    [dayEvents]
  );

  const shareBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  const shareUrl = `${shareBaseUrl}/?date=${encodeURIComponent(selected)}`;

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const selectDate = (date: string, updateUrl = true) => {
    setSelected(date);
    setShowForm(false);
    resetForm();

    if (updateUrl && typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `/?date=${date}`);
    }
  };

  const moveMonth = (delta: number) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setYear(nextYear);
    setMonth(nextMonth);
  };

  const goToday = () => {
    const [nextYear, nextMonth] = dateParts(today);
    setYear(nextYear);
    setMonth(nextMonth);
    selectDate(today);
  };

  const submit = async () => {
    if (!form.title.trim() || saving) return;

    const currentEditingId = editingId;
    const payload = {
      title: form.title.trim(),
      date: selected,
      time: form.time || null,
      owner: form.owner,
      memo: form.memo.trim() || null,
      location: form.location.trim() || null,
      placeName: form.placeName || null,
      latitude: form.latitude,
      longitude: form.longitude,
      placeUrl: form.placeUrl || null,
    };

    setSaving(true);
    try {
      const saved = await fetchJson<CalendarEvent>(
        currentEditingId ? `/api/events/${currentEditingId}` : "/api/events",
        {
          method: currentEditingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      setEvents((current) => {
        if (currentEditingId) {
          return current.map((event) =>
            event.id === currentEditingId ? saved : event
          );
        }
        return [...current, saved];
      });
      setShowForm(false);
      resetForm();
      toast({
        tone: "success",
        title: currentEditingId ? "일정을 수정했습니다" : "일정을 등록했습니다",
      });
    } catch (error) {
      toast({
        tone: "error",
        title: "일정을 저장하지 못했습니다",
        description:
          error instanceof Error
            ? error.message
            : "입력 내용을 확인하고 다시 시도해주세요.",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const event = events.find((item) => item.id === id);
    const confirmed = await confirm({
      title: "일정을 삭제할까요?",
      description: event
        ? `“${event.title}” 일정이 삭제되며 되돌릴 수 없습니다.`
        : "이 일정은 삭제 후 되돌릴 수 없습니다.",
      confirmLabel: "일정 삭제",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await fetchJson<{ ok: boolean }>(`/api/events/${id}`, {
        method: "DELETE",
      });
      setEvents((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        setShowForm(false);
        resetForm();
      }
      toast({ tone: "success", title: "일정을 삭제했습니다" });
    } catch (error) {
      toast({
        tone: "error",
        title: "일정을 삭제하지 못했습니다",
        description:
          error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      });
    }
  };

  const startEdit = (event: CalendarEvent) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      time: event.time ?? "",
      owner: event.owner,
      memo: event.memo ?? "",
      location: event.location ?? "",
      placeName: event.placeName ?? "",
      latitude: event.latitude,
      longitude: event.longitude,
      placeUrl: event.placeUrl ?? "",
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <header className="rise rise-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">함께 정리하는 일정</p>
          <h1 className="heading-serif mt-1.5 text-3xl sm:text-4xl">캘린더</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            날짜별 약속을 기록하고 하루의 방문 동선을 한곳에서 확인하세요.
          </p>
        </div>
        <button type="button" onClick={goToday} className="button-secondary self-start sm:self-auto">
          오늘 보기
        </button>
      </header>

      {loading && (
        <div
          aria-live="polite"
          aria-label="일정을 불러오는 중입니다"
          className="grid gap-6 lg:grid-cols-[1.45fr_0.9fr]"
        >
          <div className="surface-card space-y-4 p-4 sm:p-5">
            <div className="skeleton h-11 w-full" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }, (_, index) => (
                <div key={index} className="skeleton h-14 sm:h-20" />
              ))}
            </div>
          </div>
          <div className="surface-card space-y-4 p-5">
            <div className="skeleton h-7 w-1/2" />
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        </div>
      )}

      {!loading && loadError && events.length === 0 && (
        <section className="surface-card p-6 text-center" role="alert">
          <h2 className="text-lg font-bold text-stone-900">일정을 표시할 수 없습니다</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">
            {loadError}
          </p>
          <button type="button" onClick={() => void load()} className="button-primary mt-5">
            다시 불러오기
          </button>
        </section>
      )}

      {!loading && (!loadError || events.length > 0) && (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.9fr)] lg:items-start">
            <section className="min-w-0 space-y-4" aria-labelledby="calendar-month-title">
              <div className="rise rise-2 flex items-center justify-between rounded-[1.125rem] border border-rule bg-paper-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  aria-label="이전 달"
                  className="calendar-arrow"
                >
                  ‹
                </button>
                <h2
                  id="calendar-month-title"
                  className="font-display text-xl font-semibold tracking-tight text-stone-900"
                  aria-live="polite"
                >
                  {year}년 {month}월
                </h2>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  aria-label="다음 달"
                  className="calendar-arrow"
                >
                  ›
                </button>
              </div>

              <div className="rise rise-3 overflow-hidden rounded-[1.125rem] border border-rule bg-paper-2">
                <div className="grid grid-cols-7 border-b border-rule-soft text-center text-[11px] font-semibold">
                  {WEEKDAYS.map((weekday, index) => (
                    <div
                      key={weekday}
                      className={`py-2.5 ${
                        index === 0
                          ? "text-rose-600"
                          : index === 6
                            ? "text-groom-ink"
                            : "text-stone-500"
                      }`}
                    >
                      {weekday}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7" role="grid" aria-label={`${year}년 ${month}월`}>
                  {grid.map((date, index) => {
                    const dayOfWeek = index % 7;
                    const dayRows = date ? markers.get(date) ?? [] : [];
                    const isLastColumn = dayOfWeek === 6;
                    const isLastRow = index >= grid.length - 7;
                    const isSelected = date === selected;
                    const isToday = date === today;

                    if (!date) {
                      return (
                        <div
                          key={`empty-${index}`}
                          role="gridcell"
                          aria-hidden="true"
                          className={`min-h-14 bg-cream sm:min-h-20 ${
                            isLastColumn ? "" : "border-r border-rule-faint"
                          } ${isLastRow ? "" : "border-b border-rule-faint"}`}
                        />
                      );
                    }

                    const day = Number(date.slice(-2));
                    return (
                      <button
                        key={date}
                        type="button"
                        role="gridcell"
                        onClick={() => selectDate(date)}
                        aria-label={`${selectedDateLabel(date)}, 일정 ${dayRows.length}개`}
                        aria-pressed={isSelected}
                        className={`min-h-14 min-w-0 p-1 text-left align-top transition-colors duration-150 sm:min-h-20 sm:p-1.5 ${
                          isLastColumn ? "" : "border-r border-rule-faint"
                        } ${isLastRow ? "" : "border-b border-rule-faint"} ${
                          isSelected
                            ? "bg-sky-haze ring-2 ring-inset ring-sky-ink"
                            : "hover:bg-stone-50"
                        }`}
                      >
                        <time
                          dateTime={date}
                          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1 font-display text-xs ${
                            isToday
                              ? "bg-accent font-bold text-accent-ink"
                              : dayOfWeek === 0
                                ? "text-rose-600"
                                : dayOfWeek === 6
                                  ? "text-groom-ink"
                                  : "text-stone-700"
                          }`}
                        >
                          {day}
                        </time>

                        {dayRows.length > 0 && (
                          <>
                            <div className="mt-1 flex gap-1 sm:hidden" aria-hidden="true">
                              {dayRows.slice(0, 3).map((event) => (
                                <span
                                  key={event.id}
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    OWNER_STYLES[event.owner].marker
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="mt-1 hidden space-y-1 sm:block" aria-hidden="true">
                              {dayRows.slice(0, 2).map((event) => (
                                <div
                                  key={event.id}
                                  className={`truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-4 ${
                                    OWNER_STYLES[event.owner].badge
                                  }`}
                                >
                                  {event.time ? `${event.time} ` : ""}
                                  {event.title}
                                </div>
                              ))}
                              {dayRows.length > 2 && (
                                <div className="px-1 text-[10px] font-medium text-stone-500">
                                  일정 {dayRows.length - 2}개 더
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="rise rise-3 flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs font-medium text-stone-500"
                aria-label="일정 담당 범례"
              >
                {(Object.keys(OWNER_STYLES) as Owner[]).map((owner) => (
                  <span key={owner} className="inline-flex items-center">
                    <i
                      aria-hidden="true"
                      className={`legend-dot ${OWNER_STYLES[owner].marker}`}
                    />
                    {OWNER_LABELS[owner]}
                  </span>
                ))}
              </div>
            </section>

            <section
              className="rise rise-4 surface-card p-4 sm:p-6 lg:sticky lg:top-24"
              aria-labelledby="selected-day-title"
            >
              <div className="flex flex-col gap-4 border-b border-rule-soft pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="section-kicker">
                    {selected === today ? "오늘의 일정" : "선택한 날짜"}
                  </p>
                  <h2
                    id="selected-day-title"
                    className="mt-1 text-xl font-bold tracking-tight text-stone-900"
                  >
                    <time dateTime={selected}>{selectedDateLabel(selected)}</time>
                  </h2>
                  <p className="mt-1 text-xs font-medium text-stone-500">
                    일정 {dayEvents.length}개
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DayShareButton date={selected} lines={dayShareLines} url={shareUrl} />
                  <button
                    type="button"
                    onClick={() => {
                      if (showForm) {
                        setShowForm(false);
                        resetForm();
                      } else {
                        resetForm();
                        setShowForm(true);
                      }
                    }}
                    className="button-primary whitespace-nowrap"
                  >
                    {showForm ? "입력 닫기" : "일정 추가"}
                  </button>
                </div>
              </div>

              {showForm && (
                <form
                  className="space-y-4 border-b border-rule py-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <label className="field-block">
                    <span>일정 제목</span>
                    <input
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="예: 드레스숍 상담"
                      className="field-input"
                      maxLength={120}
                      required
                      autoFocus
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="field-block">
                      <span>시간</span>
                      <input
                        type="time"
                        value={form.time}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            time: event.target.value,
                          }))
                        }
                        className="field-input"
                      />
                    </label>
                    <label className="field-block">
                      <span>담당</span>
                      <select
                        value={form.owner}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            owner: event.target.value as Owner,
                          }))
                        }
                        className="field-input bg-paper-2"
                      >
                        <option value="both">{OWNER_LABELS.both}</option>
                        <option value="groom">{OWNER_LABELS.groom}</option>
                        <option value="bride">{OWNER_LABELS.bride}</option>
                      </select>
                    </label>
                  </div>

                  <label className="field-block">
                    <span>장소</span>
                    <KakaoPlaceSearchField
                      value={form.location}
                      onChange={(location) =>
                        setForm((current) => ({
                          ...current,
                          location,
                          placeName: "",
                          latitude: null,
                          longitude: null,
                          placeUrl: "",
                        }))
                      }
                      onSelect={(place: KakaoPlace) =>
                        setForm((current) => ({
                          ...current,
                          location:
                            place.roadAddress || place.address || place.name,
                          placeName: place.name,
                          latitude: place.latitude,
                          longitude: place.longitude,
                          placeUrl: place.url,
                        }))
                      }
                    />
                    {form.placeName && form.latitude != null && (
                      <span className="block text-xs font-medium text-meadow-ink">
                        {form.placeName} 위치를 선택했습니다.
                      </span>
                    )}
                  </label>

                  <label className="field-block">
                    <span>메모</span>
                    <textarea
                      value={form.memo}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          memo: event.target.value,
                        }))
                      }
                      placeholder="준비물이나 확인할 내용을 적어두세요."
                      rows={3}
                      className="field-input resize-none"
                      maxLength={1000}
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        resetForm();
                      }}
                      className="button-secondary w-full"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={!form.title.trim() || saving}
                      className="button-primary w-full"
                    >
                      {saving
                        ? "저장 중"
                        : editingId
                          ? "수정 내용 저장"
                          : "일정 등록"}
                    </button>
                  </div>
                </form>
              )}

              {dayEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold text-stone-700">
                    등록된 일정이 없습니다
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    일정 추가를 눌러 첫 약속을 기록해보세요.
                  </p>
                </div>
              ) : (
                <ol className="divide-y divide-rule-soft">
                  {dayEvents.map((event) => (
                    <li
                      key={event.id}
                      className={`border-l-4 py-4 pl-3 ${OWNER_STYLES[event.owner].border}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold text-stone-900">
                            {event.title}
                          </p>
                          <p className="mt-1 text-xs font-medium text-stone-500">
                            {[event.time, OWNER_LABELS[event.owner]]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          {event.memo && (
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-stone-600">
                              {event.memo}
                            </p>
                          )}
                          {event.location && (
                            <a
                              href={eventMapUrl(event)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex min-h-8 items-center text-xs font-semibold text-sky-ink underline underline-offset-2"
                            >
                              {event.placeName || event.location} 지도 보기
                            </a>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => startEdit(event)}
                            className="button-ghost h-9 min-h-9"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(event.id)}
                            className="inline-flex h-9 min-h-9 items-center justify-center rounded-lg px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <DayRoutePlanner date={selected} events={events} />
        </>
      )}
    </div>
  );
}
