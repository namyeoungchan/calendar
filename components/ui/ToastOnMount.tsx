"use client";

import { useEffect, useRef } from "react";
import { useFeedback, type ToastInput } from "./FeedbackProvider";

export default function ToastOnMount({ toast, clearQueryParam }: { toast: ToastInput; clearQueryParam?: string }) {
  const feedback = useFeedback();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    feedback.toast(toast);
    if (clearQueryParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete(clearQueryParam);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [clearQueryParam, feedback, toast]);

  return null;
}
