import { Link, useLocation } from "wouter";
import { LayoutDashboard, Settings as SettingsIcon, List, Printer } from "lucide-react";
import { useHealthCheck } from "@/hooks/api";

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ refetchInterval: 30000 });

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/jobs", label: "Job History", icon: List },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Printer className="w-6 h-6 text-primary mr-3" />
          <h1 className="font-bold text-lg text-sidebar-foreground tracking-tight uppercase">Print Bridge</h1>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground">
          <div className="flex items-center justify-between mb-2">
            <span>Relay API:</span>
            <div className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  health?.status === "ok" ? "bg-primary animate-pulse" : "bg-destructive"
                }`}
              />
              <span className={health?.status === "ok" ? "text-primary" : "text-destructive"}>
                {health?.status === "ok" ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
