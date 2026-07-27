import { redirect } from "next/navigation";
import ConnectClient from "@/components/ConnectClient";
import ToastOnMount from "@/components/ui/ToastOnMount";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getConnectionState } from "@/lib/data";
import { AccountMissingError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await requireAuthenticatedSession();
  const connection = await getConnectionState(session.userId, session.coupleId).catch((error) => {
    if (error instanceof AccountMissingError) redirect("/api/auth/logout");
    throw error;
  });
  if (connection.connected) redirect("/");
  const { notice } = await searchParams;

  return (
    <>
      {notice === "test-reset" && (
        <ToastOnMount
          toast={{
            tone: "success",
            title: "테스트 연결을 해제했습니다",
            description: "이제 실제 상대방의 사용자 코드를 입력할 수 있습니다.",
          }}
          clearQueryParam="notice"
        />
      )}
      <ConnectClient initialConnection={connection} nickname={session.nickname} />
    </>
  );
}
