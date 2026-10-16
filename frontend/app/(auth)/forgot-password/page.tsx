import type { Metadata } from "next";
import { RecoveryShell } from "../recovery-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Lupa Kata Sandi" };

export default function ForgotPasswordPage() {
  return (
    <RecoveryShell title="Lupa Kata Sandi?">
      <ForgotForm />
    </RecoveryShell>
  );
}
