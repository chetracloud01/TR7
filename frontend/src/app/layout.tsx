import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "TR7",
  description: "Personal LLM hub, football predictions, and bankroll control.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is deliberately overwritten by THEME_INIT_SCRIPT before
    // hydration (a saved preference beats this "warm" default) — that's
    // expected drift, not a real mismatch, so it's suppressed here rather
    // than warning on every load for anyone with a non-default theme.
    <html lang="en" data-theme="warm" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Newsreader:ital,wght@0,500;0,600;0,700;1,500&family=Source+Serif+4:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased" style={{ fontFamily: "var(--font-body)" }}>
        {children}
      </body>
    </html>
  );
}
