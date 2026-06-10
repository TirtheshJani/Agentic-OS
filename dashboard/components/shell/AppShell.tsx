import { NavSidebar } from "@/components/shell/NavSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
