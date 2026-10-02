import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "UsahaKu — Kalkulator HPP & Catat Kas UMKM Kuliner",
    template: "%s · UsahaKu",
  },
  description:
    "Hitung HPP per porsi, tentukan harga jual, dan pantau untung rugi usaha kuliner kamu setiap hari.",
};

// Light by default (easier to read in daylight for older users). Runs before paint so a saved dark preference doesn't flash light first.
const themeScript = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={jakarta.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
