import type { Metadata } from "next";
import { Baloo_Tammudu_2, Inter, Noto_Sans_Telugu } from "next/font/google";

import "./globals.css";

// Same fonts as the farmer app (design/tokens.json): Inter for text, Noto Sans Telugu for Telugu,
// Baloo Tammudu 2 for headings. Self-hosted by Next.js; the variables feed --font-sans / --font-display.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoTelugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--font-noto-telugu", display: "swap" });
const baloo = Baloo_Tammudu_2({ subsets: ["latin", "telugu"], variable: "--font-baloo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Annadata 360 ERP", template: "%s · Annadata 360" },
  description: "Vendor portal and admin panel for Annadata 360",
  robots: { index: false, follow: false }, // a private business tool: keep it out of search engines
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${notoTelugu.variable} ${baloo.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
