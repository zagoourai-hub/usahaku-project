import type { Metadata } from "next";
import { RecipeEditor } from "../recipe-editor";

export const metadata: Metadata = { title: "Resep Baru" };

export default function NewRecipePage() {
  return <RecipeEditor />;
}
