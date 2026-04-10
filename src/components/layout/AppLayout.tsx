import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useLanguage } from "@/contexts/LanguageProvider";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import {
  Inbox,
  Users,
  Settings,
  Send,
  PlayCircle,
  X,
  LogOut,
  Shield,
  Printer,
  LayoutDashboard,
  User,
  CalendarClock,
  MoreHorizontal,
  Menu,
} from "lucide-react";
import { authService } from "@/services/authService";
import { userService } from "@/services/userService";

type UserRole = "member" | "group_admin" | "tenant_admin" | string;

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const ALL_NAV: NavItem[] = [
  { labelKey: "nav.dashboard",  href: "/",           icon: LayoutDashboard, roles: ["member", "group_admin", "tenant_admin"] },
  { labelKey: "nav.inbox",      href: "/inbox",       icon: Inbox,           roles: ["member", "group_admin", "tenant_admin"] },
  { labelKey: "nav.vaktliste",  href: "/vaktliste",   icon: CalendarClock,   roles: ["member", "group_admin", "tenant_admin"] },
  { labelKey: "nav.contacts",   href: "/contacts",    icon: Users,           roles: ["member", "group_admin", "tenant_admin"] },
  { labelKey: "nav.sending",    href: "/sending",     icon: Send,            roles: ["tenant_admin"] },
  { labelKey: "nav.simulate",   href: "/simulate",    icon: PlayCircle,      roles: ["tenant_admin"] },
  { labelKey: "nav.admin",      href: "/admin",       icon: Shield,          roles: ["tenant_admin"] },
  { labelKey: "nav.settings",   href: "/settings",    icon: Settings,        roles: ["tenant_admin"] },
];

// Bottom nav always shows these 3 + "Mer" button
const BOTTOM_NAV_HREFS = ["/", "/inbox", "/vaktliste"];

function roleLabel(role: string, t: (k: string) => string): string {
  if (role === "member")       return t("role.member");
  if (role === "group_admin")  return t("role.group_admin");
  if (role === "tenant_admin") return t("role.tenant_admin");
  if (role === "super_admin")  return t("role.super_admin");
  if (role === "admin")        return t("role.admin");
  if (role === "user")         return t("role.user");
  return role;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("member");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notifBanner, setNotifBanner] = useState(false);
  const appCommit = process.env.NEXT_PUBLIC_APP_COMMIT || "local-dev";

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default" &&
      !localStorage.getItem("semse_notification_asked")
    ) {
      setNotifBanner(true);
    }
  }, []);

  const handleNotifEnable = () => {
    localStorage.setItem("semse_notification_asked", "1");
    setNotifBanner(false);
    Notification.requestPermission();
  };

  const handleNotifDismiss = () => {
    localStorage.setItem("semse_notification_asked", "1");
    setNotifBanner(false);
  };

  const checkAuth = async () => {
    try {
      const session = await authService.getCurrentSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const profile = await userService.getCurrentUserProfile();
      setUserRole(profile?.role || "member");
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

  // Items visible to this role
  const visibleNav = ALL_NAV.filter((item) => item.roles.includes(userRole));

  // Desktop sidebar: all visible items
  // Mobile bottom nav: fixed 3 items + "Mer" sheet with the rest
  const bottomNavItems = visibleNav.filter((item) => BOTTOM_NAV_HREFS.includes(item.href));
  const moreItems = visibleNav.filter((item) => !BOTTOM_NAV_HREFS.includes(item.href));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  const NavLink = ({
    item,
    onClick,
    compact = false,
  }: {
    item: NavItem;
    onClick?: () => void;
    compact?: boolean;
  }) => {
    const isActive = router.pathname === item.href;
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px]",
          compact && "px-3 py-2 min-h-[44px]",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        <span>{t(item.labelKey)}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Mobile top header (hidden on md+) ─────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 h-16 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex flex-col">
          <Link href="/" className="text-2xl font-bold text-primary">
            SeMSe
          </Link>
          <span className="text-[10px] text-muted-foreground">Commit: {appCommit}</span>
        </div>
        {/* Hamburger only on mobile for edge-case nav access */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-12 w-12"
          aria-label={sidebarOpen ? t("common.close") : t("nav.open_menu")}
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </header>

      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out flex flex-col",
          "md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b flex-none">
          <Link href="/" className="text-2xl font-bold text-primary">
            SeMSe
          </Link>
          <div className="text-xs text-muted-foreground mt-1">
            Commit: <span className="font-mono">{appCommit}</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink key={item.href} item={item} onClick={() => setSidebarOpen(false)} />
          ))}
        </nav>

        <div className="p-4 border-t space-y-2 flex-none">
          <Link
            href="/profile"
            onClick={() => setSidebarOpen(false)}
            className="block px-4 py-3 bg-muted/50 rounded-lg space-y-1 hover:bg-muted transition-colors group"
          >
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                {userName}
              </span>
            </div>
            {userRole && (
              <div className="text-xs text-muted-foreground pl-6">
                {roleLabel(userRole, t)}
              </div>
            )}
          </Link>
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

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0">
        {/* Notification permission banner */}
        {notifBanner && (
          <div className="bg-primary/10 border-b px-4 py-2 flex items-center justify-between gap-3 text-sm">
            <span className="flex-1">{t("notif.banner_text")}</span>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" className="h-7 px-3 text-xs" onClick={handleNotifEnable}>
                {t("notif.enable")}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={handleNotifDismiss}>
                {t("notif.not_now")}
              </Button>
            </div>
          </div>
        )}
        <div className="container mx-auto p-4 md:p-6 lg:p-8">{children}</div>
      </main>

      {/* ── Mobile bottom nav bar (hidden on md+) ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t flex items-stretch h-16">
        {bottomNavItems.map((item) => {
          const isActive = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}

        {/* "Mer" button — opens sheet if there are overflow items */}
        {moreItems.length > 0 ? (
          <SheetPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetPrimitive.Trigger asChild>
              <button className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                <MoreHorizontal className="h-5 w-5" />
                <span>{t("nav.more")}</span>
              </button>
            </SheetPrimitive.Trigger>
            <SheetPrimitive.Portal>
              <SheetPrimitive.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
              <SheetPrimitive.Content className="fixed bottom-0 inset-x-0 z-50 bg-card rounded-t-2xl border-t p-4 pb-8 space-y-1 max-h-[70vh] overflow-y-auto focus:outline-none">
                <SheetPrimitive.Title className="sr-only">{t("nav.more")}</SheetPrimitive.Title>
                <div className="mx-auto w-10 h-1 bg-muted rounded-full mb-4" />
                <Link
                  href="/profile"
                  onClick={() => setSheetOpen(false)}
                  className="block px-4 py-3 bg-muted/50 rounded-lg space-y-1 mb-3 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {userName}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground pl-6">{roleLabel(userRole, t)}</div>
                </Link>
                {moreItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    onClick={() => setSheetOpen(false)}
                    compact
                  />
                ))}
                <div className="flex gap-2 pt-2">
                  <LanguageSwitch />
                  <ThemeSwitch />
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start min-h-[48px] mt-2"
                  onClick={async () => {
                    setSheetOpen(false);
                    await handleLogout();
                  }}
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  {t("nav.logout")}
                </Button>
              </SheetPrimitive.Content>
            </SheetPrimitive.Portal>
          </SheetPrimitive.Root>
        ) : (
          <button
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            <span>{t("nav.logout")}</span>
          </button>
        )}
      </nav>
    </div>
  );
}
