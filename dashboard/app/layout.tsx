import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Playfair_Display, Montserrat, Oswald } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";

const display = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const body = Montserrat({ subsets: ["latin"], variable: "--font-body" });
const label = Oswald({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-label" });

export const metadata: Metadata = {
  title: "Agentic OS",
  description: "Personal command center",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "/icons/icon-192.png", sizes: "192x192" },
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
};

// Runs before paint so the chosen theme never flashes. localStorage wins;
// otherwise follow the OS preference.
const themeInit = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${label.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
