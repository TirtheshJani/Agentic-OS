import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic OS",
  description: "Personal command center on top of Claude Code",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
