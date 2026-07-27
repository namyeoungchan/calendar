"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "info" | "success" | "error";

interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
  duration: number;
}

export interface ConfirmInput {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

interface ConfirmRequest extends ConfirmInput {
  resolve: (confirmed: boolean) => void;
}

interface FeedbackContextValue {
  toast: (input: ToastInput) => void;
  confirm: (input: ConfirmInput) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="m4.5 10.5 3.2 3.2 7.8-8" />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M10 3.2 17 16H3L10 3.2Z" />
        <path d="M10 7.2v4.2M10 14h.01" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4M10 6.5h.01" />
    </svg>
  );
}

function ToastCard({ item, dismiss }: { item: ToastItem; dismiss: () => void }) {
  const remaining = useRef(item.duration);
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = setTimeout(dismiss, remaining.current);
  }, [dismiss]);

  const pauseTimer = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [startTimer]);

  return (
    <article
      role={item.tone === "error" ? "alert" : "status"}
      className={`app-toast app-toast--${item.tone}`}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocus={pauseTimer}
      onBlur={startTimer}
    >
      <span className="app-toast__icon"><ToastIcon tone={item.tone} /></span>
      <div className="min-w-0 flex-1">
        <p className="app-toast__title">{item.title}</p>
        {item.description && <p className="app-toast__description">{item.description}</p>}
        {item.action && (
          <button
            type="button"
            className="app-toast__action"
            onClick={() => {
              item.action?.onClick();
              dismiss();
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} className="app-toast__close" aria-label="알림 닫기">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="m6 6 8 8M14 6l-8 8" />
        </svg>
      </button>
    </article>
  );
}

function ConfirmDialog({
  request,
  finish,
}: {
  request: ConfirmRequest | null;
  finish: (confirmed: boolean) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [finish, request]);

  if (!request) return null;

  return (
    <div
      className="app-dialog-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) finish(false);
      }}
    >
      <section
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-description"
        className="app-dialog"
      >
        <div className="app-dialog__panel">
          <div className={`app-dialog__mark app-dialog__mark--${request.tone ?? "default"}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 3.5v10M12 17.5h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <h2 id="app-confirm-title" className="app-dialog__title">{request.title}</h2>
          <p id="app-confirm-description" className="app-dialog__description">{request.description}</p>
          <div className="app-dialog__actions">
            <button ref={cancelButtonRef} type="button" onClick={() => finish(false)} className="button-secondary">
              {request.cancelLabel ?? "취소"}
            </button>
            <button
              type="button"
              onClick={() => finish(true)}
              className={request.tone === "danger" ? "button-danger" : "button-primary"}
            >
              {request.confirmLabel ?? "확인"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const nextToastId = useRef(1);

  const toast = useCallback((input: ToastInput) => {
    const item: ToastItem = {
      ...input,
      id: nextToastId.current++,
      tone: input.tone ?? "info",
      duration: input.duration ?? (input.tone === "error" ? 6500 : 4200),
    };
    setToasts((current) => [...current.slice(-2), item]);
  }, []);

  const confirm = useCallback((input: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      setConfirmRequest((current) => {
        current?.resolve(false);
        return { ...input, resolve };
      });
    });
  }, []);

  const finishConfirm = useCallback((confirmed: boolean) => {
    setConfirmRequest((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      <div>{children}</div>
      <div className="app-toast-viewport" aria-label="알림">
        {toasts.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            dismiss={() => setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))}
          />
        ))}
      </div>
      <ConfirmDialog request={confirmRequest} finish={finishConfirm} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback must be used within FeedbackProvider.");
  return value;
}
