import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "./globals.css";

/**
 * Type is loaded through next/font, which self-hosts the files and emits the
 * @font-face rules at build time. No network request to a font CDN, no layout
 * shift while a webfont swaps in, and no dependency on a third party staying up.
 */

export const metadata: Metadata = {
  title: "Pipdrift",
  description:
    "An open rebalancing engine. Spare change into ETF buckets, corrected by agents you can read.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        {/* Scroll reveals start hidden and are shown by script. Without
            JavaScript that script never runs, so the content would sit at
            opacity 0 forever, invisible to a reader and to anything that does
            not execute JS. This puts it back. */}
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html:
                ".pd-reveal{opacity:1!important;transform:none!important}",
            }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
