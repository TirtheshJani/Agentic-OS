import { NavSidebar } from "@/components/shell/NavSidebar";
import { TopHeader } from "@/components/shell/TopHeader";
import { KillSwitchBanner } from "@/components/shell/KillSwitchBanner";
import { QuickCapture } from "@/components/notes/QuickCapture";
import { CommandPalette } from "@/components/shell/CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    // relative z-[1] lifts the shell above the fixed cosmic atmosphere
    // (body::before/::after in globals.css), which paints at z-index 0.
    <div className="relative z-[1] flex min-h-screen">
      <NavSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />
        <KillSwitchBanner />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <QuickCapture />
      <CommandPalette />
    </div>
  );
}
