import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppShell } from "./app-shell";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Server-side read so the sidebar renders at its saved width on first paint.
  const sidebar = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  return <AppShell defaultSidebarOpen={sidebar !== "false"}>{children}</AppShell>;
}
