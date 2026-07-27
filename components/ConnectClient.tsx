"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { ConnectionState } from "@/lib/types";
import { useFeedback } from "@/components/ui/FeedbackProvider";
import { formatConnectionCode, SOLO_TEST_CONNECTION_CODE } from "@/lib/connection";

function LinkMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <path d="M12.8 19.2 19.2 12.8" />
      <path d="M9.4 22.6 6.8 25.2a5.3 5.3 0 0 1-7.5-7.5l5-5a5.3 5.3 0 0 1 7.5 0" transform="translate(4 -3)" />
      <path d="m22.6 9.4 2.6-2.6a5.3 5.3 0 0 1 7.5 7.5l-5 5a5.3 5.3 0 0 1-7.5 0" transform="translate(-4 3)" />
    </svg>
  );
}

export default function ConnectClient({
  initialConnection,
  nickname,
}: {
  initialConnection: ConnectionState;
  nickname: string;
}) {
  const { toast, confirm } = useFeedback();
  const [partnerCode, setPartnerCode] = useState("");
  const [connecting, setConnecting] = useState(false);

  const ownCode = formatConnectionCode(initialConnection.user_code);
  const soloTestCode = formatConnectionCode(SOLO_TEST_CONNECTION_CODE);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(initialConnection.user_code);
      toast({ tone: "success", title: "사용자 코드를 복사했습니다" });
    } catch {
      toast({
        tone: "error",
        title: "코드를 복사하지 못했습니다",
        description: "코드를 길게 눌러 직접 복사해주세요.",
      });
    }
  };

  const connect = async () => {
    const isSoloTest = partnerCode.replace(/-/g, "") === SOLO_TEST_CONNECTION_CODE;
    const confirmed = await confirm({
      title: isSoloTest ? "테스트 파트너를 만들까요?" : "두 사람을 연결할까요?",
      description: isSoloTest
        ? "이 계정에 테스트 파트너를 생성해 모든 기능을 혼자 확인할 수 있습니다. 나중에 설정에서 테스트 연결만 해제할 수 있습니다."
        : "연결하면 두 사람의 일정과 업체 정보가 하나의 공간으로 합쳐집니다. 연결 정보는 Firebase에 저장되어 로그아웃하거나 다시 로그인해도 계속 유지됩니다.",
      confirmLabel: isSoloTest ? "테스트 시작" : "연결하기",
    });
    if (!confirmed) return;
    try {
      setConnecting(true);
      await fetchJson<ConnectionState>("/api/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: partnerCode }),
      });
      window.location.assign("/?notice=connected");
    } catch (connectError) {
      toast({
        tone: "error",
        title: "연결을 완료하지 못했습니다",
        description: connectError instanceof Error ? connectError.message : "상대방 코드를 확인하고 다시 시도해주세요.",
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="connect-shell relative mx-auto max-w-4xl py-4 sm:py-8">
      <header className="rise rise-1 max-w-2xl">
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-rule bg-paper-2 text-accent">
          <LinkMark className="h-6 w-6" />
        </div>
        <p className="section-kicker">둘의 웨딩 공간</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-ink sm:text-5xl">
          먼저 두 사람을 연결해요
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-muted sm:text-lg">
          {nickname}님의 코드를 상대방에게 보내거나, 상대방에게 받은 코드를 입력하세요. 연결된 뒤 일정과 업체 정보를 함께 사용할 수 있습니다.
        </p>
      </header>

      <div className="rise rise-2 surface-card mt-9 grid overflow-hidden md:grid-cols-[1.05fr_0.95fr]">
        <section className="p-6 sm:p-9" aria-labelledby="share-code-heading">
          <p className="text-sm font-semibold text-stone-500">내 코드 공유하기</p>
          <h2 id="share-code-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-ink">
            상대방이 이 코드를 입력해요
          </h2>
          <div className="mt-8 border-y border-rule py-7">
            <p className="text-sm text-slate-muted">{nickname}님의 사용자 코드</p>
            <code className="mt-2 block select-all text-[clamp(1.75rem,7vw,2.75rem)] font-bold leading-none tracking-[0.08em] text-sky-ink tabular-nums">
              {ownCode}
            </code>
          </div>
          <button type="button" onClick={copyCode} className="button-secondary mt-6 w-full">
            내 코드 복사
          </button>
        </section>

        <section className="border-t border-rule bg-stone-50 p-6 sm:p-9 md:border-l md:border-t-0" aria-labelledby="enter-code-heading">
          <p className="text-sm font-semibold text-stone-500">상대방 코드 입력하기</p>
          <h2 id="enter-code-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-ink">
            내가 받은 코드가 있나요?
          </h2>
          <form
            className="mt-8"
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            <label className="field-block" htmlFor="partner-code">
              <span>상대방 사용자 코드</span>
              <input
                id="partner-code"
                value={partnerCode}
                onChange={(event) => setPartnerCode(formatConnectionCode(event.target.value))}
                className="field-input mt-2 font-semibold uppercase tracking-[0.12em] tabular-nums"
                placeholder="ABCDE-23456"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                maxLength={11}
              />
            </label>
            <p className="mt-3 text-sm leading-6 text-slate-muted">
              연결 정보는 계정에 저장되어 다시 로그인해도 계속 유지됩니다.
            </p>
            <button
              type="submit"
              disabled={connecting || partnerCode.replace("-", "").length !== 10}
              className="button-primary mt-6 w-full"
            >
              {connecting
                ? "연결 확인 중"
                : partnerCode.replace(/-/g, "") === SOLO_TEST_CONNECTION_CODE
                  ? "테스트 파트너와 연결"
                  : "상대방과 연결"}
            </button>
          </form>

          <div className="mt-8 border-t border-rule pt-6">
            <p className="text-sm font-semibold text-slate-ink">혼자 기능을 테스트하나요?</p>
            <p className="mt-2 text-sm leading-6 text-slate-muted">
              아래 전용 코드를 사용하면 이 계정에 테스트 파트너가 생성됩니다.
            </p>
            <button
              type="button"
              onClick={() => setPartnerCode(soloTestCode)}
              className="button-secondary mt-4 w-full"
            >
              테스트 코드 입력 · {soloTestCode}
            </button>
          </div>
        </section>
      </div>

      <div className="rise rise-3 mt-6 flex flex-col gap-3 border-t border-rule pt-5 text-sm leading-6 text-slate-muted sm:flex-row sm:items-center sm:justify-between">
        <p>연결 전에는 캘린더와 업체 관리 기능이 잠겨 있습니다.</p>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="button-ghost min-h-11 px-0 sm:px-3">다른 계정으로 로그인</button>
        </form>
      </div>
    </div>
  );
}
