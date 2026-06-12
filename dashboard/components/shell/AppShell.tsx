import { NavSidebar } from "@/components/shell/NavSidebar";
import { TopHeader } from "@/components/shell/TopHeader";
import { KillSwitchBanner } from "@/components/shell/KillSwitchBanner";
import { QuickCapture } from "@/components/notes/QuickCapture";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader />
        <KillSwitchBanner />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <QuickCapture />
    </div>
  );
}
