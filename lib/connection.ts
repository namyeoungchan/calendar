export const SOLO_TEST_CONNECTION_CODE = "TESTPARTNR";

export function formatConnectionCode(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
  return normalized.length > 5 ? `${normalized.slice(0, 5)}-${normalized.slice(5)}` : normalized;
}
