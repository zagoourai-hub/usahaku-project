import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "../_components/logo";

type Props = {
  title: string;
  switchText: string;
  switchHref: string;
  switchLabel: string;
  badge: string;
  headline: string;
  desc: string;
  chip: string;
  preview: ReactNode;
  quote: string;
  children: ReactNode;
};

export function AuthShell({ title, switchText, switchHref, switchLabel, badge, headline, desc, chip, preview, quote, children }: Props) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-[#0f766e] p-12 text-white lg:flex xl:p-16 [&_:focus-visible]:outline-white"
        style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      >
        <Logo onDark />
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1 font-mono text-xs font-bold text-[#99f6e4]">
            <span aria-hidden className="size-1.5 rounded-full bg-[#5eead4]" /> {badge}
          </span>
          <p className="mt-5 text-balance text-4xl font-extrabold leading-tight tracking-tight">{headline}</p>
          <p className="mt-4 leading-relaxed text-[#ccfbf1]/85">{desc}</p>
          <div className="mt-8">{preview}</div>
        </div>
        <blockquote className="border-t border-white/15 pt-8 italic leading-relaxed text-[#f0fdfa]/90">“{quote}”</blockquote>
      </aside>

      <div className="flex flex-col">
        {/* Mobile top bar */}
        <header className="flex h-16 items-center justify-between border-b px-4 lg:hidden">
          <Link href="/" className="flex items-center gap-2 rounded text-[15px] font-medium">
            <ArrowLeft className="size-5" /> Kembali
          </Link>
          <Logo />
        </header>

        <main className="flex flex-1 flex-col items-center px-4 py-6 lg:justify-center lg:px-12 lg:py-12">
          <div className="w-full max-w-md">
            <div className="mb-6 rounded-2xl bg-[#0f766e] p-5 text-white lg:hidden">
              <p className="text-lg font-bold leading-snug">{headline}</p>
              <p className="mt-1 text-sm text-[#ccfbf1]">{desc}</p>
              <p className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs">{chip}</p>
            </div>

            <Link href="/" className="mb-8 hidden items-center gap-2 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:inline-flex">
              <ArrowLeft className="size-4" /> Kembali ke Beranda
            </Link>

            <div className="rounded-2xl border bg-card p-6 lg:border-0 lg:bg-transparent lg:p-0">
              <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">{title}</h1>
              <p className="mt-2 text-muted-foreground">
                {switchText}{" "}
                <Link href={switchHref} className="rounded font-semibold text-primary underline-offset-4 hover:underline">
                  {switchLabel}
                </Link>
              </p>
              <div className="mt-8">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
