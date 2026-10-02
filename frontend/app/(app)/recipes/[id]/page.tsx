import type { Metadata } from "next";
import { RecipeEditor } from "../recipe-editor";

export const metadata: Metadata = { title: "Detail Resep" };

export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  return <RecipeEditor id={id} />;
}
