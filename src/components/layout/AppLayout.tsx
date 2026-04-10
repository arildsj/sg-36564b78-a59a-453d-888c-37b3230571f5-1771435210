import React, { useState, useEffect, useRef } from "react";
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
  Bell,
} from "lucide-react";
import { authService } from "@/services/authService";
import { userService } from "@/services/userService";
import { supabase } from "@/integrations/supabase/client";
import { playAlert } from "@/services/SoundService";

const db = supabase as any;

type UserRole = "member" | "group_admin" | "tenant_admin" | string;

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

interface PendingRequest {
  id: string;
  group_name: string;
  requester_name: string;
}

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifBanner, setNotifBanner] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const appCommit = process.env.NEXT_PUBLIC_APP_COMMIT || "local-dev";

  // Refs for stable closures in Realtime handlers
  const currentUserIdRef = useRef<string | null>(null);
  const prevRequestIdRef = useRef<string | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkAuth();
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // ── Notification permission banner ───────────────────────────────────────────
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

  // ── Play sound whenever a new pending request arrives ────────────────────────
  useEffect(() => {
    if (pendingRequest && pendingRequest.id !== prevRequestIdRef.current) {
      prevRequestIdRef.current = pendingRequest.id;
      playAlert("activation");
    }
    if (!pendingRequest) {
      prevRequestIdRef.current = null;
    }
  }, [pendingRequest]);

  // ── Realtime subscription for activation_requests ────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;

    const channel = db
      .channel("applayout-activation")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activation_requests" },
        (payload: any) => {
          console.log("[Realtime] applayout-activation EVENT:", payload.eventType, payload);
          const uid = currentUserIdRef.current;
          if (!uid) return;
          // On INSERT: check if this request targets us, then update state
          if (payload.eventType === "INSERT") {
            const req = payload.new;
            if (
              Array.isArray(req.requested_user_ids) &&
              req.requested_user_ids.includes(uid)
            ) {
              // Fetch group + requester names, then set pendingRequest
              // (the sound effect will fire automatically via the pendingRequest effect)
              loadPendingActivations(uid);
              return;
            }
          }
          loadPendingActivations(uid);
        }
      )
      .subscribe((status, err) => {
        console.log("[Realtime] applayout-activation STATUS:", status);
        if (err) console.error("[Realtime] applayout-activation error:", err);
      });

    return () => {
      db.removeChannel(channel);
    };
  }, [currentUserId]);

  const loadPendingActivations = async (userId: string) => {
    const { data: reqs } = await db
      .from("activation_requests")
      .select("id, group_id, requested_user_ids, requester_id")
      .eq("status", "pending");

    const mine = ((reqs ?? []) as any[]).find(
      (r: any) =>
        Array.isArray(r.requested_user_ids) &&
        r.requested_user_ids.includes(userId)
    );

    if (!mine) {
      setPendingRequest(null);
      return;
    }

    // Fetch group name and requester name in parallel
    const [{ data: grp }, { data: requester }] = await Promise.all([
      db.from("groups").select("name").eq("id", mine.group_id).maybeSingle(),
      db.from("user_profiles").select("full_name, email").eq("id", mine.requester_id).maybeSingle(),
    ]);

    setPendingRequest({
      id: mine.id,
      group_name: grp?.name ?? "ukjent gruppe",
      requester_name:
        (requester as any)?.full_name ||
        (requester as any)?.email ||
        "En annen bruker",
    });
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
      // Setting this triggers the Realtime useEffect
      setCurrentUserId(session.user.id);
      loadPendingActivations(session.user.id);
    } catch (error) {
      console.error("Auth check failed:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleNotifEnable = () => {
    localStorage.setItem("semse_notification_asked", "1");
    setNotifBanner(false);
    Notification.requestPermission();
  };

  const handleNotifDismiss = () => {
    localStorage.setItem("semse_notification_asked", "1");
    setNotifBanner(false);
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

  const hasPendingBadge = !!pendingRequest;

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
    const hasBadge = item.href === "/vaktliste" && hasPendingBadge;
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
        <span className="relative flex-shrink-0">
          <item.icon className="h-5 w-5" />
          {hasBadge && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-card" />
          )}
        </span>
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

        {/* Pending activation request banner — shown on ALL pages */}
        {pendingRequest && (
          <Link
            href="/vaktliste"
            className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 transition-colors text-sm group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-amber-900 dark:text-amber-200 truncate">
                {t("vaktliste.request_banner")}{" "}
                <strong>{pendingRequest.group_name}</strong>
              </span>
            </div>
            <span className="text-amber-700 dark:text-amber-300 text-xs font-medium group-hover:underline shrink-0">
              {t("vaktliste.see_request")} →
            </span>
          </Link>
        )}

        <div className="container mx-auto p-4 md:p-6 lg:p-8">{children}</div>
      </main>

      {/* ── Mobile bottom nav bar (hidden on md+) ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t flex items-stretch h-16">
        {bottomNavItems.map((item) => {
          const isActive = router.pathname === item.href;
          const hasBadge = item.href === "/vaktliste" && hasPendingBadge;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-card" />
                )}
              </span>
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
