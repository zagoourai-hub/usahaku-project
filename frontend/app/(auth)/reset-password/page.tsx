import type { Metadata } from "next";
import { RecoveryShell } from "../recovery-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Kata Sandi Baru" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  return (
    <RecoveryShell title="Buat Kata Sandi Baru">
      <ResetForm token={typeof token === "string" ? token : ""} />
    </RecoveryShell>
  );
}
