import type { Metadata } from "next";
import { ReceiptReview } from "./receipt-review";

export const metadata: Metadata = { title: "Review Struk" };

export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  const { id } = await params;
  return <ReceiptReview id={id} />;
}
