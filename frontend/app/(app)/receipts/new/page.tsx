import type { Metadata } from "next";
import { ReceiptCapture } from "./receipt-capture";

export const metadata: Metadata = { title: "Scan Struk" };

export default function NewReceiptPage() {
  return <ReceiptCapture />;
}
