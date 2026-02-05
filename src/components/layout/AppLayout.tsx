import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import {
  Home,
  Inbox,
  Users,
  Settings,
  Send,
  PlayCircle,
  Menu,
  X,
  LogOut,
  Shield,
  Megaphone,
} from "lucide-react";
import { authService } from "@/services/authService";
import { userService } from "@/services/userService";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Innboks", href: "/inbox", icon: Inbox },
  { label: "Kontakter", href: "/contacts", icon: Users },
  { label: "Send melding", href: "/sending", icon: Send },
  { label: "Kampanjer", href: "/campaigns", icon: Megaphone },
  { label: "Simulering", href: "/simulate", icon: PlayCircle },
  { label: "Administrasjon", href: "/admin", icon: Shield, adminOnly: true },
  { label: "Innstillinger", href: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await authService.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const profile = await userService.getCurrentUserProfile();
      setUserRole(profile?.role || null);
    } catch (error) {
      console.error("Auth check failed:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    router.push("/login");
  };

  const handleNavClick = () => {
    setSidebarOpen(false);
  };

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return userRole === "tenant_admin" || userRole === "system_admin";
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Laster...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className={cn("md:hidden flex items-center justify-between px-4 h-16 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40")}>
        <Link href="/" className="text-2xl font-bold text-primary">
          SeMSe
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-12 w-12"
          aria-label={sidebarOpen ? "Lukk meny" : "Åpne meny"}
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out flex flex-col",
          "md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b flex-none">
          <Link href="/" className="text-2xl font-bold text-primary">
            SeMSe 2.0
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px]",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2 flex-none">
          <ThemeSwitch />
          <Button 
            variant="outline" 
            className="w-full justify-start min-h-[48px]" 
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logg ut
          </Button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen">
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}