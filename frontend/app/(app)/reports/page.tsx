import type { Metadata } from "next";
import { Reports } from "./reports";

export const metadata: Metadata = { title: "Laporan" };

export default function ReportsPage() {
  return <Reports />;
}
