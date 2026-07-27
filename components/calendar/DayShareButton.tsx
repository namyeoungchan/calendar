"use client";

import { useState } from "react";
import { useFeedback } from "@/components/ui/FeedbackProvider";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dayTitle(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()] ?? "";
  return `${year}년 ${month}월 ${day}일${weekday ? ` ${weekday}요일` : ""} 일정`;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("클립보드 복사를 지원하지 않는 브라우저입니다.");
}

export default function DayShareButton({
  date,
  lines,
  url,
}: {
  date: string;
  lines: string[];
  url: string;
}) {
  const { toast } = useFeedback();
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (sharing) return;

    const title = dayTitle(date);
    const scheduleLines = lines.length > 0 ? lines : ["등록된 일정이 없습니다."];
    const text = `${title}\n${scheduleLines.map((line) => `- ${line}`).join("\n")}`;

    setSharing(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") return;
        }
      }

      await copyText(`${text}\n${url}`);
      toast({
        tone: "success",
        title: "일정과 링크를 복사했습니다",
        description: "메신저에 붙여넣어 공유할 수 있습니다.",
      });
    } catch (shareError) {
      toast({
        tone: "error",
        title: "일정을 공유하지 못했습니다",
        description:
          shareError instanceof Error
            ? shareError.message
            : "브라우저의 공유 또는 클립보드 권한을 확인해주세요.",
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={sharing}
      className="button-secondary whitespace-nowrap"
      aria-label={`${dayTitle(date)} 공유`}
    >
      {sharing ? "공유 준비 중" : "일정 공유"}
    </button>
  );
}
