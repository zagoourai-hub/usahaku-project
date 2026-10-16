"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Camera, ChartColumn, ChevronLeft, ChevronRight, House, LogOut, Package, ReceiptText, ScanLine, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useBusiness } from "@/lib/business";
import { useOcrQuota } from "@/lib/receipts";
import {
  AnimatedSidebar,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarHeader,
  AnimatedSidebarInset,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarProvider,
  AnimatedSidebarRail,
  AnimatedSidebarTrigger,
  useAnimatedSidebar,
} from "@/components/ui/animated-sidebar";
import { Logo } from "../_components/logo";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";
import { ThemeToggle } from "../_components/theme-toggle";

// `short`: label for the 6-column mobile bottom nav, where long words at 14px+ collide.
type NavItem = { href: string; label: string; short?: string; Icon: LucideIcon };
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Beranda", Icon: House },
  { href: "/recipes", label: "Resep", Icon: UtensilsCrossed },
  { href: "/ingredients", label: "Bahan", Icon: Package },
  { href: "/transactions", label: "Transaksi", short: "Kas", Icon: ReceiptText },
  { href: "/reports", label: "Laporan", Icon: ChartColumn },
];

const SCAN: NavItem = { href: "/receipts/new", label: "Scan", Icon: Camera };

/** Read back by layout.tsx so the first paint already has the saved width (no expand-then-collapse flash). */
function persistSidebar(open: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${open}; path=/; max-age=31536000; samesite=lax`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function AppShell({ children, defaultSidebarOpen }: { children: ReactNode; defaultSidebarOpen: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();

  const logout = useMutation({
    mutationFn: () => api("/auth/sign-out", { method: "POST", body: "{}" }),
    onSettled: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <AnimatedSidebarProvider defaultOpen={defaultSidebarOpen} onOpenChange={persistSidebar} className="min-h-dvh">
      {/* Desktop sidebar: full width or icon rail (Ctrl+B / button in the top bar). Mobile uses the bottom nav. */}
      {/* z above the sticky top bar (z-40) so the shadow and the edge toggle stay on top of the content column. */}
      <AnimatedSidebar
        ariaLabel="Menu samping"
        collapsible="icon"
        edge={<SidebarToggle />}
        className="z-[41]"
        panelClassName="shadow-[6px_0_24px_-12px_rgb(0_0_0/0.25)] dark:shadow-[6px_0_24px_-10px_rgb(0_0_0/0.7)]"
      >
        <SidebarBody isActive={isActive} onLogout={() => logout.mutate()} loggingOut={logout.isPending} />
        <AnimatedSidebarRail />
      </AnimatedSidebar>

      <AnimatedSidebarInset className="pb-16 lg:pb-0">
        {/* Top bar — business context, notifications, account */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur-sm md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="lg:hidden">
              <Logo solid />
            </span>
            {business && (
              <span className="hidden min-w-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium sm:flex dark:bg-card-inner">
                <Store aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{business.name}</span>
                {business.branchLabel && <span className="hidden font-bold text-primary sm:inline">· {business.branchLabel}</span>}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Notifications />
            <span className="lg:hidden"><ThemeToggle /></span>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="Keluar"
              className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground lg:hidden"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>

        {children}

        {/* Bottom nav — mobile */}
        <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-6 border-t bg-card lg:hidden">
          {[...NAV.slice(0, 3), SCAN, ...NAV.slice(3)].map(({ href, label, short, Icon }) =>
            href === SCAN.href ? (
              <Link key={href} href={href} aria-current={isActive("/receipts") ? "page" : undefined} className="flex flex-col items-center justify-end pb-1.5 text-xs font-bold text-primary">
                <span className="-mt-7 mb-0.5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background">
                  <Icon className="size-6" />
                </span>
                {label}
              </Link>
            ) : (
            <Link
              key={href}
              href={href}
             
              aria-current={isActive(href) ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground aria-[current=page]:font-bold aria-[current=page]:text-primary"
            >
              <Icon className="size-6" /> {short ?? label}
            </Link>
            ),
          )}
        </nav>
      </AnimatedSidebarInset>
    </AnimatedSidebarProvider>
  );
}

/** Round button sitting on the sidebar's border line (rendered through AnimatedSidebar `edge`). */
function SidebarToggle() {
  const { open } = useAnimatedSidebar();
  const label = open ? "Sembunyikan menu" : "Tampilkan menu";
  return (
    <AnimatedSidebarTrigger
      aria-label={label}
      title={`${label} (Ctrl+B)`}
      className="size-9 rounded-full border bg-card text-muted-foreground shadow-md transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
    >
      {open ? <ChevronLeft aria-hidden className="size-5" /> : <ChevronRight aria-hidden className="size-5" />}
    </AnimatedSidebarTrigger>
  );
}

function SidebarBody({ isActive, onLogout, loggingOut }: { isActive: (href: string) => boolean; onLogout: () => void; loggingOut: boolean }) {
  const { open, isMobile } = useAnimatedSidebar();
  const collapsed = !open && !isMobile;
  const { data: business } = useBusiness();
  const ocr = useOcrQuota();
  const ocrLimit = ocr.data?.limit ?? null;
  const name = business?.user.name ?? "";

  return (
    <>
      <AnimatedSidebarHeader className="h-16 justify-center border-b px-3 py-0">
        <Logo solid iconOnly={collapsed} />
      </AnimatedSidebarHeader>

      <AnimatedSidebarContent className="gap-3 px-2 py-3">
        <Link
          href="/receipts/new"
          aria-label={collapsed ? "Scan Struk Belanja" : undefined}
          title={collapsed ? "Scan Struk Belanja" : undefined}
          className="flex h-12 shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary-hover"
        >
          <ScanLine aria-hidden className="size-5 shrink-0" />
          {!collapsed && "Scan Struk Belanja"}
        </Link>
        <nav aria-label="Menu utama">
          <AnimatedSidebarMenu>
            {NAV.map(({ href, label, Icon }) => (
              <AnimatedSidebarMenuItem key={href}>
                <AnimatedSidebarMenuButton href={href} isActive={isActive(href)} icon={<Icon className="size-5" />}>
                  {label}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            ))}
          </AnimatedSidebarMenu>
        </nav>
      </AnimatedSidebarContent>

      <AnimatedSidebarFooter className="border-t-0 p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span title={name} className="flex size-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              <span aria-hidden>{name ? initials(name) : ""}</span>
              <span className="sr-only">{name}</span>
            </span>
            <button type="button" onClick={onLogout} disabled={loggingOut} aria-label="Keluar" title="Keluar" className="flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <LogOut className="size-5" />
            </button>
            <ThemeToggle compact />
          </div>
        ) : (
          <div className="rounded-xl border bg-background p-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                {name ? initials(name) : ""}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold" title={name}>{name || "…"}</p>
                <p className="truncate text-xs text-muted-foreground">{business?.name}</p>
              </div>
              <button type="button" onClick={onLogout} disabled={loggingOut} aria-label="Keluar" title="Keluar" className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <LogOut className="size-5" />
              </button>
            </div>
            {ocr.data && ocrLimit !== null && (
              <div className="mt-3 border-t pt-3">
                <div className="flex items-center justify-between gap-2 whitespace-nowrap text-xs">
                  <span>Kuota scan struk</span>
                  <b className="text-primary">{ocr.data.used} / {ocrLimit}</b>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track" role="meter" aria-label="Kuota scan struk terpakai" aria-valuemin={0} aria-valuemax={ocrLimit} aria-valuenow={Math.min(ocr.data.used, ocrLimit)}>
                  <div className={`h-full rounded-full ${ocr.data.used / ocrLimit >= 0.8 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, (ocr.data.used / ocrLimit) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Sisa {Math.max(0, ocrLimit - ocr.data.used)} scan bulan ini</p>
              </div>
            )}
            <div className="mt-3 border-t pt-3">
              <ThemeToggle />
            </div>
          </div>
        )}
      </AnimatedSidebarFooter>
    </>
  );
}

// Mirrors NotificationService (backend/src/notification/notification.module.ts).
type Notification = { id: string; title: string; href: string; createdAt: string };

const SEEN_KEY = "notifications-seen-at";
function readSeenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0; // storage blocked: everything counts as unread
  }
}

function Notifications() {
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/notifications"),
    refetchInterval: 5 * 60_000,
  });
  // Read state is per browser: notifications are derived server-side, not stored.
  // List dots use the last-seen time from page load, so new items stay marked while browsing.
  const [seenAt] = useState(readSeenAt);
  const [openedAt, setOpenedAt] = useState(0);
  const time = (n: Notification) => new Date(n.createdAt).getTime();
  const isRead = (n: Notification) => time(n) <= seenAt;
  const unread = data.filter((n) => time(n) > Math.max(seenAt, openedAt)).length;

  function markSeen() {
    const now = Date.now();
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      // ignore: the badge just comes back after a reload
    }
    setOpenedAt(now);
  }

  return (
    <>
      <button
        type="button"
        popoverTarget="notif-popover"
        onClick={markSeen}
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
        className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-expense ring-2 ring-background" />}
      </button>
      {/* Native popover: light-dismiss + Esc for free */}
      <div id="notif-popover" popover="auto" className="fixed inset-auto right-4 top-16 m-0 w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-2 text-popover-foreground shadow-md">
        <p className="px-2 py-1.5 text-sm font-bold">Notifikasi</p>
        {data.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Belum ada notifikasi.</p>
        ) : (
          <ul>
            {data.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  onClick={() => document.getElementById("notif-popover")?.hidePopover()}
                  className="flex gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                >
                  <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${isRead(n) ? "bg-track" : "bg-primary"}`} />
                  <span className={isRead(n) ? "text-muted-foreground" : ""}>{n.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
