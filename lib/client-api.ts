export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.assign("/login");
    } else if (response.status === 403 && typeof window !== "undefined") {
      window.location.assign("/connect");
    }
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "요청을 처리하지 못했습니다.";
    throw new ApiRequestError(message, response.status);
  }
  return data as T;
}
