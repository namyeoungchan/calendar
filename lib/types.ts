export type Owner = "groom" | "bride" | "both";

export const OWNER_LABELS: Record<Owner, string> = {
  groom: "신랑",
  bride: "신부",
  both: "함께",
};

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  owner: Owner;
  memo: string | null;
  location: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  placeUrl: string | null;
}

export interface ConnectionMember {
  id: string;
  nickname: string;
  is_test: boolean;
}

export interface ConnectionState {
  connected: boolean;
  user_code: string;
  partner: ConnectionMember | null;
}

export interface KakaoPlace {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  url: string;
  phone: string;
}

export interface RouteStop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  time: string | null;
  source: "event";
}
