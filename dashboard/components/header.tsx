"use client";

import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";

export function Header({ running }: { running: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-3 py-2">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-base font-semibold tracking-widest">
          AGENTICOS<span className="text-primary"> · </span>MMXXVI
        </span>
        <Pill tone="muted" glyph="·">{running ? "RUNNING" : "IDLE"}</Pill>
      </div>
      <nav className="flex items-center gap-4 mono-label text-muted-foreground">
        <Link href="/" className="hover:text-foreground">VAULT</Link>
        <Link href="/analytics" className="hover:text-foreground">ANALYTICS</Link>
        <Link href="https://www.tirtheshjani.com" target="_blank" className="hover:text-foreground">SITE ↗</Link>
        <StatusDot state={running ? "running" : "idle"} />
      </nav>
    </header>
  );
}
