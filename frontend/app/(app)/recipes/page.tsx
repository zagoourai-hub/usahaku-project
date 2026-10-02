import type { Metadata } from "next";
import { Recipes } from "./recipes";

export const metadata: Metadata = { title: "Resep" };

export default function RecipesPage() {
  return <Recipes />;
}
