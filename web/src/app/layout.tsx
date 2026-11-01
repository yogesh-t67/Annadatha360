import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Annadata 360 ERP", template: "%s · Annadata 360" },
  description: "Vendor portal and admin panel for Annadata 360",
  robots: { index: false, follow: false }, // a private business tool: keep it out of search engines
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
