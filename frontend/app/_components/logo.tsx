import Link from "next/link";
import { Calculator } from "lucide-react";

/** `solid`: filled teal mark used inside the app (Stitch app screens); tinted on the landing. `iconOnly`: collapsed sidebar rail. */
export function Logo({ onDark = false, solid = false, iconOnly = false }: { onDark?: boolean; solid?: boolean; iconOnly?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-lg" aria-label="UsahaKu — beranda">
      <span className={`flex size-9 items-center justify-center rounded-lg ${onDark ? "bg-[#0f766e] ring-1 ring-white/25" : solid ? "bg-primary" : "border border-primary/20 bg-primary/10 dark:border-primary/30 dark:bg-primary/15"}`}>
        <Calculator className={`size-5 ${onDark ? "text-white" : solid ? "text-primary-foreground" : "text-primary"}`} />
      </span>
      {!iconOnly && (
        <span className={`text-xl font-bold tracking-tight ${onDark ? "text-white" : "text-foreground"}`}>
          Usaha<span className={onDark ? "text-[#fbbf24]" : "text-warning"}>Ku</span>
        </span>
      )}
    </Link>
  );
}
