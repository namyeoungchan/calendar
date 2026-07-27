import type { CalendarEvent, Owner } from "./types";

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export class AccountMissingError extends Error {
  constructor(message = "로그인 계정을 찾지 못했습니다. 다시 로그인해주세요.") {
    super(message);
    this.name = "AccountMissingError";
  }
}

type JsonObject = Record<string, unknown>;

const OWNERS: Owner[] = ["groom", "bride", "both"];

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("요청 형식이 올바르지 않습니다.");
  }
  return value as JsonObject;
}

function requiredText(value: unknown, label: string, max = 120): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InputError(`${label}을(를) 입력해주세요.`);
  }
  const result = value.trim();
  if (result.length > max) {
    throw new InputError(`${label}은(는) ${max}자 이내로 입력해주세요.`);
  }
  return result;
}

function optionalText(value: unknown, label: string, max: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new InputError(`${label} 형식이 올바르지 않습니다.`);
  const result = value.trim();
  if (!result) return null;
  if (result.length > max) {
    throw new InputError(`${label}은(는) ${max}자 이내로 입력해주세요.`);
  }
  return result;
}

function isoDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputError("날짜 형식은 YYYY-MM-DD여야 합니다.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new InputError("실제 존재하는 날짜를 입력해주세요.");
  }
  return value;
}

function optionalTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new InputError("시간 형식은 HH:MM이어야 합니다.");
  }
  return value;
}

function optionalCoordinate(
  value: unknown,
  label: string,
  min: number,
  max: number
): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new InputError(`${label} 좌표가 올바르지 않습니다.`);
  }
  return value;
}

function optionalHttpUrl(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = requiredText(value, "장소 링크", 500);
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new InputError("장소 링크는 http 또는 https 주소여야 합니다.");
  }
}

export function parseEventInput(value: unknown): Omit<CalendarEvent, "id"> {
  const body = object(value);
  if (!OWNERS.includes(body.owner as Owner)) {
    throw new InputError("일정 담당자를 선택해주세요.");
  }

  const latitude = optionalCoordinate(body.latitude, "위도", -90, 90);
  const longitude = optionalCoordinate(body.longitude, "경도", -180, 180);
  if ((latitude == null) !== (longitude == null)) {
    throw new InputError("장소 위도와 경도는 함께 입력해주세요.");
  }

  return {
    title: requiredText(body.title, "일정 제목"),
    date: isoDate(body.date),
    time: optionalTime(body.time),
    owner: body.owner as Owner,
    memo: optionalText(body.memo, "메모", 1000),
    location: optionalText(body.location, "장소 주소", 300),
    placeName: optionalText(body.placeName, "장소명", 120),
    latitude,
    longitude,
    placeUrl: optionalHttpUrl(body.placeUrl),
  };
}

export function parseId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(value)) {
    throw new InputError("올바르지 않은 일정 번호입니다.");
  }
  return value;
}

export function parseUserCode(value: unknown): string {
  const body = object(value);
  if (typeof body.user_code !== "string") {
    throw new InputError("상대방의 사용자 코드를 입력해주세요.");
  }
  const code = body.user_code.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-HJ-NP-Z2-9]{10}$/.test(code)) {
    throw new InputError("사용자 코드는 영문과 숫자 10자리입니다.");
  }
  return code;
}
