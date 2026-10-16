import type { Metadata } from "next";
import { RecoveryShell } from "../recovery-shell";
import { VerifyEmail } from "./verify-email";

export const metadata: Metadata = { title: "Konfirmasi Email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  return (
    <RecoveryShell title="Konfirmasi Email">
      <VerifyEmail token={typeof token === "string" ? token : ""} />
    </RecoveryShell>
  );
}
