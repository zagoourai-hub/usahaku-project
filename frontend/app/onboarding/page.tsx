import type { Metadata } from "next";
import { Logo } from "../_components/logo";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Profil Usaha" };

export default function OnboardingPage() {
  return (
    <div className="min-h-dvh">
      <header className="flex h-16 items-center border-b px-4 md:px-8">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-lg px-4 py-8 md:py-12">
        <p className="font-mono text-xs font-bold text-primary">Langkah terakhir</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Kenalan dulu sama usahamu</h1>
        <p className="mt-2 text-muted-foreground">Isi profil singkat usahamu. Bisa diubah kapan saja.</p>
        <div className="mt-8">
          <OnboardingForm />
        </div>
      </main>
    </div>
  );
}
