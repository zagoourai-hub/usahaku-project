import type { Metadata } from "next";
import { Transactions } from "./transactions";

export const metadata: Metadata = { title: "Transaksi" };

export default function TransactionsPage() {
  return <Transactions />;
}
