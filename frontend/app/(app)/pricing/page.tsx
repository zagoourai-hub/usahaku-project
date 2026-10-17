import type { Metadata } from "next";
import { Pricing } from "./pricing";

export const metadata: Metadata = { title: "Paket & Harga" };

export default function PricingPage() {
  return <Pricing />;
}
