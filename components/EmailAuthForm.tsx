"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createEmailUser,
  isEmailVerified,
  sendResetEmail,
  sendVerificationEmail,
  signInEmailUser,
} from "@/lib/firebase-email-auth";
import { useFeedback } from "@/components/ui/FeedbackProvider";

type Mode = "login" | "signup";

const AUTH_ERRORS: Record<string, string> = {
  EMAIL_EXISTS: "이미 가입된 이메일입니다. 로그인해주세요.",
  EMAIL_NOT_FOUND: "이메일 또는 비밀번호가 올바르지 않습니다.",
  INVALID_EMAIL: "올바른 이메일 주소를 입력해주세요.",
  INVALID_LOGIN_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
  INVALID_PASSWORD: "이메일 또는 비밀번호가 올바르지 않습니다.",
  OPERATION_NOT_ALLOWED: "Firebase Console에서 이메일 로그인을 먼저 활성화해주세요.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  USER_DISABLED: "사용이 중지된 계정입니다.",
  WEAK_PASSWORD: "비밀번호는 6자 이상 입력해주세요.",
};

function authErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "FirebaseEmailAuthError") {
    return AUTH_ERRORS[error.message] || "인증 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
  return error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.";
}

export default function EmailAuthForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const completeServerLogin = async (idToken: string) => {
    const response = await fetch("/api/auth/email/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(body?.error || "로그인 세션을 만들지 못했습니다.");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured) {
      toast({ tone: "error", title: "로그인 설정이 필요합니다", description: "Firebase 웹 앱 환경변수를 확인해주세요." });
      return;
    }
    if (mode === "signup" && password !== passwordConfirm) {
      toast({ tone: "error", title: "비밀번호가 일치하지 않습니다" });
      return;
    }

    try {
      setSubmitting(true);
      if (mode === "signup") {
        const credential = await createEmailUser(email.trim(), password, name.trim());
        await sendVerificationEmail(credential.idToken);
        setMode("login");
        setPassword("");
        setPasswordConfirm("");
        toast({
          tone: "success",
          title: "인증메일을 보냈습니다",
          description: "메일의 인증 링크를 누른 뒤 이 화면에서 로그인해주세요. 스팸함도 확인해주세요.",
          duration: 8000,
        });
        return;
      }

      const credential = await signInEmailUser(email.trim(), password);
      if (!(await isEmailVerified(credential.idToken))) {
        await sendVerificationEmail(credential.idToken);
        toast({
          tone: "info",
          title: "이메일 인증이 필요합니다",
          description: "새 인증메일을 보냈습니다. 인증 링크를 누른 뒤 다시 로그인해주세요.",
          duration: 8000,
        });
        return;
      }

      await completeServerLogin(credential.idToken);
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: mode === "signup" ? "가입하지 못했습니다" : "로그인하지 못했습니다", description: authErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      toast({ tone: "info", title: "이메일을 먼저 입력해주세요" });
      return;
    }
    try {
      setResetting(true);
      await sendResetEmail(email.trim());
      toast({ tone: "success", title: "비밀번호 재설정 메일을 보냈습니다", description: "메일함에서 재설정 링크를 확인해주세요." });
    } catch (error) {
      toast({ tone: "error", title: "재설정 메일을 보내지 못했습니다", description: authErrorMessage(error) });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mt-7">
      <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1" role="tablist" aria-label="로그인 방식">
        {(["login", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${mode === item ? "bg-paper-2 text-stone-900 shadow-sm" : "text-stone-500"}`}
            onClick={() => setMode(item)}
          >
            {item === "login" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        {mode === "signup" && (
          <label className="field-block">
            <span>이름</span>
            <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={40} required placeholder="앱에서 사용할 이름" />
          </label>
        )}
        <label className="field-block">
          <span>이메일</span>
          <input className="field-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required placeholder="name@example.com" />
        </label>
        <label className="field-block">
          <span>비밀번호</span>
          <input className="field-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required placeholder="6자 이상" />
        </label>
        {mode === "signup" && (
          <label className="field-block">
            <span>비밀번호 확인</span>
            <input className="field-input" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} autoComplete="new-password" minLength={6} required placeholder="비밀번호 다시 입력" />
          </label>
        )}

        <button type="submit" disabled={submitting || !configured} className="button-primary w-full">
          {submitting ? "처리 중" : mode === "signup" ? "인증메일 받고 가입하기" : "로그인"}
        </button>
        {mode === "login" && (
          <button type="button" disabled={resetting || !configured} onClick={() => void resetPassword()} className="button-ghost w-full">
            {resetting ? "메일 보내는 중" : "비밀번호를 잊으셨나요?"}
          </button>
        )}
      </form>
    </div>
  );
}
