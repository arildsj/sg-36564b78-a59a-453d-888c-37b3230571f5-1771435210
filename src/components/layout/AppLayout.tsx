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
} from "lucide-react";
import { authService } from "@/services/authService";
import { userService } from "@/services/userService";

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/", icon: Home },
  { labelKey: "nav.inbox", href: "/inbox", icon: Inbox },
  { labelKey: "nav.contacts", href: "/contacts", icon: Users },
  { labelKey: "nav.send", href: "/sending", icon: Send },
  { labelKey: "nav.campaigns", href: "/campaigns", icon: Megaphone },
  { labelKey: "nav.simulate", href: "/simulate", icon: PlayCircle },
  { labelKey: "nav.admin", href: "/admin", icon: Shield, adminOnly: true },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
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

      const profile = await userService.getCurrentUser();
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

  const menuItems = [
    { 
      href: "/", 
      label: t("nav.home"), 
      icon: <Home className="h-4 w-4" /> 
    },
    { 
      href: "/inbox", 
      label: t("nav.inbox"), 
      icon: <MessageSquare className="h-4 w-4" />,
      badge: unreadCount > 0 ? unreadCount : undefined 
    },
    { 
      href: "/contacts", 
      label: t("nav.contacts"), 
      icon: <Users className="h-4 w-4" /> 
    },
    { 
      href: "/sending", 
      label: t("nav.sending"), 
      icon: <Send className="h-4 w-4" /> 
    },
    { 
      href: "/campaigns", 
      label: t("nav.campaigns"), 
      icon: <BarChart className="h-4 w-4" /> 
    },
    { 
      href: "/print-to-sms", 
      label: "Print to SMS", 
      icon: <Printer className="h-4 w-4" /> 
    },
    { 
      href: "/simulate", 
      label: t("nav.simulate"), 
      icon: <TestTube className="h-4 w-4" /> 
    },
    { 
      href: "/admin", 
      label: t("nav.admin"), 
      icon: <Shield className="h-4 w-4" />,
      requiresAdmin: true 
    },
    { 
      href: "/settings", 
      label: t("nav.settings"), 
      icon: <Settings className="h-4 w-4" /> 
    }
  ];

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
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2 flex-none">
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