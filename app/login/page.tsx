import { redirect } from "next/navigation";
import EmailAuthForm from "@/components/EmailAuthForm";
import ToastOnMount from "@/components/ui/ToastOnMount";
import { getSession } from "@/lib/auth";
import { isDataConnectConfigured, isFirebaseConfigured } from "@/lib/firebase-admin";

const ERROR_MESSAGES: Record<string, string> = {
  denied: "카카오 로그인이 취소되었습니다.",
  state: "로그인 요청이 만료되었습니다. 다시 시도해주세요.",
  failed: "로그인을 완료하지 못했습니다. 설정을 확인한 뒤 다시 시도해주세요.",
  config: "카카오 로그인 환경변수가 설정되지 않았습니다.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; verified?: string }>;
}) {
  if (await getSession()) redirect("/");
  const { error, verified } = await searchParams;
  const baseConfigured = Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_SECRET.length >= 32 &&
      isFirebaseConfigured() &&
      isDataConnectConfigured()
  );
  const kakaoConfigured = baseConfigured && Boolean(process.env.KAKAO_REST_API_KEY);
  const emailConfigured =
    baseConfigured &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md items-center">
      {error && (
        <ToastOnMount
          toast={{
            tone: "error",
            title: "로그인을 완료하지 못했습니다",
            description: ERROR_MESSAGES[error] || ERROR_MESSAGES.failed,
          }}
          clearQueryParam="error"
        />
      )}
      {verified === "1" && (
        <ToastOnMount
          toast={{
            tone: "success",
            title: "이메일 인증을 완료했습니다",
            description: "가입한 이메일과 비밀번호로 로그인해주세요.",
          }}
          clearQueryParam="verified"
        />
      )}
      {!kakaoConfigured && !emailConfigured && (
        <ToastOnMount
          toast={{
            tone: "error",
            title: "로그인 설정이 필요합니다",
            description: "Vercel의 Firebase와 카카오 환경변수를 확인해주세요.",
          }}
        />
      )}

      <section className="rise rise-1 surface-card relative w-full overflow-hidden p-7 sm:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-white">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
            aria-hidden="true"
          >
            <rect x="4.5" y="6.5" width="23" height="21" rx="5" />
            <path d="M10 4.5v5M22 4.5v5M4.5 13h23" />
            <path d="m11.5 20 3 3 6-7" />
          </svg>
        </span>

        <p className="section-kicker mt-8">
          <span aria-hidden="true" className="kicker-rule mr-3" />
          둘이 함께 기록하는 일정
        </p>
        <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-stone-900">
          우리 캘린더에 로그인
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          기존 웨딩플래너 계정으로 로그인하면 두 사람이 기록한 일정을 그대로 불러옵니다.
        </p>

        <a
          href={kakaoConfigured ? "/api/auth/kakao" : undefined}
          aria-disabled={!kakaoConfigured}
          className={`mt-7 flex min-h-12 w-full items-center justify-center rounded-xl bg-kakao px-4 text-sm font-bold text-kakao-ink transition-[background-color,transform] duration-150 hover:bg-kakao-hover active:scale-[0.98] ${
            kakaoConfigured ? "" : "pointer-events-none opacity-45"
          }`}
        >
          카카오로 계속하기
        </a>

        <div className="mt-7 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-rule-soft" />
          <span className="text-xs font-semibold text-stone-400">또는 이메일로</span>
          <span className="h-px flex-1 bg-rule-soft" />
        </div>

        <EmailAuthForm configured={emailConfigured} />

        <p className="mt-5 text-center text-xs leading-5 text-stone-500">
          인증 정보는 캘린더 저장소에 보관하지 않으며, 기존 Firebase 계정과 연결합니다.
        </p>
      </section>
    </div>
  );
}
