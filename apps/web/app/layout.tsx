import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Syne, DM_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/lib/seo";
import "./globals.css";

const heading = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading"
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
  metadataBase: new URL(site.url)
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable}`}>
        <div className="bg-orb bg-orb-a" aria-hidden="true" />
        <div className="bg-orb bg-orb-b" aria-hidden="true" />
        <div className="site-frame">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
