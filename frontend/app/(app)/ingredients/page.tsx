import type { Metadata } from "next";
import { Ingredients } from "./ingredients";

export const metadata: Metadata = { title: "Bahan Baku" };

export default function IngredientsPage() {
  return <Ingredients />;
}
