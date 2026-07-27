import CalendarClient from "@/components/CalendarClient";
import ToastOnMount from "@/components/ui/ToastOnMount";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function publicBaseUrl(): string {
  const configured = process.env.PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; notice?: string }>;
}) {
  await requireSession();
  const { date, notice } = await searchParams;
  return (
    <>
      {notice === "connected" && (
        <ToastOnMount
          toast={{
            tone: "success",
            title: "두 사람을 연결했습니다",
            description: "이제 같은 캘린더에서 일정을 함께 기록할 수 있습니다.",
          }}
          clearQueryParam="notice"
        />
      )}
      <CalendarClient
        initialDate={validDate(date) ? date : undefined}
        publicBaseUrl={publicBaseUrl()}
      />
    </>
  );
}
