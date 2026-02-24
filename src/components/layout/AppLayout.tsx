import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useLanguage } from "@/contexts/LanguageProvider";
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
  Printer,
  LayoutDashboard,
  User,
} from "lucide-react";
import { authService } from "@/services/authService";
import { userService } from "@/services/userService";

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  rawLabel?: string; // Fallback for items not in translation yet
};

const navItems: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { labelKey: "nav.inbox", href: "/inbox", icon: Inbox },
  { labelKey: "nav.contacts", href: "/contacts", icon: Users },
  { labelKey: "nav.sending", href: "/sending", icon: Send },
  { labelKey: "nav.print_to_sms", href: "/print-to-sms", icon: Printer },
  { labelKey: "nav.simulate", href: "/simulate", icon: PlayCircle },
  { labelKey: "nav.admin", href: "/admin", icon: Shield },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await authService.getCurrentSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const profile = await userService.getCurrentUserProfile();
      setUserRole(profile?.role || null);
      setUserName(profile?.full_name || profile?.email || "Bruker");
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

  const filteredNavItems = navItems;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t("common.loading")}</div>
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
          aria-label={sidebarOpen ? t("common.close") : "Open menu"}
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
                {item.rawLabel || t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2 flex-none">
          {/* User Info Section */}
          <div className="px-4 py-3 bg-muted/50 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{userName}</span>
            </div>
            {userRole && (
              <div className="text-xs text-muted-foreground pl-6">
                {userRole === "super_admin" ? "Super Admin" : 
                 userRole === "admin" ? "Administrator" : 
                 userRole === "user" ? "Bruker" : userRole}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-start min-h-[48px]" 
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            {t("nav.logout")}
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