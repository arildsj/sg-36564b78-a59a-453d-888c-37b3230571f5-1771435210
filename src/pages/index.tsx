import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare,
  Users,
  Send,
  Shield,
  Activity,
  ArrowRight,
  AlertCircle,
  Inbox,
  CalendarClock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageProvider";
import { messageService } from "@/services/messageService";
import { userService } from "@/services/userService";

const db = supabase as any;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  role: string;
  tenantId: string;
  userId: string;
  // all roles
  unreadMessages: number;
  recentMessages: any[];
  // member only
  isOnDuty: boolean;
  onDutyGroupCount: number;
  // group_admin + tenant_admin
  operativeGroupCount: number;
  totalContacts: number;
  staffingAlerts: { id: string; name: string; active: number; min: number }[];
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function fetchDashboardData(userId: string, tenantId: string, role: string): Promise<DashboardData> {
  const base: DashboardData = {
    role, tenantId, userId,
    unreadMessages: 0,
    recentMessages: [],
    isOnDuty: false,
    onDutyGroupCount: 0,
    operativeGroupCount: 0,
    totalContacts: 0,
    staffingAlerts: [],
  };

  // ── All roles: unread messages ────────────────────────────────────────────
  const { count: unreadCount } = await db
    .from("message_threads")
    .select("*", { count: "exact", head: true })
    .eq("is_resolved", false);
  base.unreadMessages = unreadCount ?? 0;

  // ── All roles: recent messages ────────────────────────────────────────────
  base.recentMessages = await messageService.getRecentMessages(5);

  // ── Member: duty status ───────────────────────────────────────────────────
  if (role === "member") {
    const { data: memberships } = await db
      .from("group_memberships")
      .select("group_id, is_active")
      .eq("user_id", userId);
    const active = ((memberships ?? []) as any[]).filter((m: any) => m.is_active);
    base.isOnDuty = active.length > 0;
    base.onDutyGroupCount = active.length;
  }

  // ── group_admin + tenant_admin: group count, contacts, staffing alerts ────
  if (role === "group_admin" || role === "tenant_admin") {
    // Operative group count
    const { count: groupCount } = await db
      .from("groups")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    base.operativeGroupCount = groupCount ?? 0;

    // Total contacts
    const { count: contactsCount } = await db
      .from("contacts")
      .select("*", { count: "exact", head: true });
    base.totalContacts = contactsCount ?? 0;

    // Staffing alerts: groups where active members < min_active
    const { data: groupsWithMin } = await db
      .from("groups")
      .select("id, name, min_active")
      .eq("tenant_id", tenantId)
      .gt("min_active", 0);

    if (groupsWithMin?.length) {
      const groupIds = groupsWithMin.map((g: any) => g.id);
      const { data: activeMembers } = await db
        .from("group_memberships")
        .select("group_id")
        .in("group_id", groupIds)
        .eq("is_active", true);

      const activeByGroup: Record<string, number> = {};
      ((activeMembers ?? []) as any[]).forEach((m: any) => {
        activeByGroup[m.group_id] = (activeByGroup[m.group_id] ?? 0) + 1;
      });

      base.staffingAlerts = (groupsWithMin as any[])
        .map((g: any) => ({
          id: g.id,
          name: g.name,
          active: activeByGroup[g.id] ?? 0,
          min: g.min_active,
        }))
        .filter((g) => g.active < g.min);
    }
  }

  return base;
}

// ── Shared: clickable stat card ───────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  iconClass,
  href,
}: {
  title: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="cursor-pointer transition-shadow hover:shadow-md hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={iconClass ?? "h-4 w-4 text-muted-foreground"} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useLanguage();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setAuthChecked(true);
    });
  }, [router]);

  // Data fetch — runs once auth confirmed
  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session!;
        const profile = await userService.getCurrentUserProfile();
        if (!profile) { router.push("/login"); return; }
        const result = await fetchDashboardData(session.user.id, profile.tenant_id, profile.role);
        setData(result);
      } finally {
        setLoading(false);
      }
    })();
  }, [authChecked, router]);

  // ── Loading states ──────────────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t("dashboard.checking_access")}</p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const { role } = data;
  const isAdmin = role === "group_admin" || role === "tenant_admin";
  const isTenantAdmin = role === "tenant_admin";

  // ── Stat cards ──────────────────────────────────────────────────────────────

  const statCards = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Unread messages — all roles */}
      <StatCard
        title={t("dashboard.unhandled_messages")}
        value={data.unreadMessages}
        sub={t("dashboard.requires_followup")}
        icon={Inbox}
        href="/inbox"
      />

      {/* Member: duty status */}
      {role === "member" && (
        <StatCard
          title={t("dashboard.my_duty_status")}
          value={
            <span className={data.isOnDuty ? "text-green-600" : "text-muted-foreground"}>
              {data.isOnDuty ? t("vaktliste.on_duty") : t("vaktliste.off_duty")}
            </span>
          }
          sub={
            data.isOnDuty
              ? `${t("dashboard.active_in")} ${data.onDutyGroupCount} ${data.onDutyGroupCount === 1 ? t("dashboard.group_singular") : t("dashboard.group_plural")}`
              : t("dashboard.not_on_duty_sub")
          }
          icon={data.isOnDuty ? CheckCircle2 : XCircle}
          iconClass={data.isOnDuty ? "h-4 w-4 text-green-500" : "h-4 w-4 text-muted-foreground"}
          href="/vaktliste"
        />
      )}

      {/* group_admin + tenant_admin: operative groups */}
      {isAdmin && (
        <StatCard
          title={t("dashboard.operational_groups")}
          value={data.operativeGroupCount}
          sub={t("dashboard.active_in_service")}
          icon={Shield}
          href="/vaktliste"
        />
      )}

      {/* group_admin + tenant_admin: total contacts */}
      {isAdmin && (
        <StatCard
          title={t("contacts.title")}
          value={data.totalContacts}
          sub={t("dashboard.registered_in_system")}
          icon={Users}
          href="/contacts"
        />
      )}

      {/* tenant_admin: system status */}
      {isTenantAdmin && (
        <StatCard
          title={t("dashboard.system_status")}
          value={<span className="text-green-600">{t("dashboard.normal")}</span>}
          sub={t("dashboard.all_services_operational")}
          icon={Activity}
          iconClass="h-4 w-4 text-green-500"
          href="/admin"
        />
      )}
    </div>
  );

  // ── Lower section ───────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <Head><title>Dashboard – SeMSe</title></Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground">{t("dashboard.welcome_back")}</p>
          </div>
          <Button onClick={() => router.push("/sending")}>
            <Send className="mr-2 h-4 w-4" /> {t("dashboard.new_message")}
          </Button>
        </div>

        {statCards}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Recent messages */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>{t("dashboard.recent_messages")}</CardTitle>
              <CardDescription>{t("dashboard.recent_activity_inbox")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recentMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("dashboard.no_messages")}
                  </p>
                ) : (
                  data.recentMessages.map((msg) => (
                    <Link
                      key={msg.id}
                      href="/inbox"
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 hover:bg-muted/40 rounded px-1 -mx-1 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium leading-none">{msg.from_number}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{msg.content}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </div>
                    </Link>
                  ))
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/inbox">
                    {t("dashboard.go_to_inbox")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions / alerts */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>{t("dashboard.actions")}</CardTitle>
              <CardDescription>{t("dashboard.needs_attention")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Staffing alerts — all roles */}
                {data.staffingAlerts.length > 0 && (
                  <Link href="/vaktliste" className="block">
                    <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer">
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                            {t("dashboard.staffing_alert")}
                          </h3>
                          <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc pl-5 space-y-1">
                            {data.staffingAlerts.map((g) => (
                              <li key={g.id}>
                                {g.name}: {g.active} {t("dashboard.on_duty")} ({t("dashboard.on_duty_min")} {g.min})
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {/* Shortcuts */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t("dashboard.shortcuts")}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="justify-start" asChild>
                      <Link href="/contacts">
                        <Users className="mr-2 h-4 w-4" /> {t("contacts.title")}
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="justify-start" asChild>
                      <Link href="/vaktliste">
                        <CalendarClock className="mr-2 h-4 w-4" /> {t("nav.vaktliste")}
                      </Link>
                    </Button>
                    {isTenantAdmin && (
                      <>
                        <Button variant="outline" size="sm" className="justify-start" asChild>
                          <Link href="/print-to-sms">
                            <Send className="mr-2 h-4 w-4" /> Print-to-SMS
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" className="justify-start" asChild>
                          <Link href="/admin">
                            <Shield className="mr-2 h-4 w-4" /> {t("nav.admin")}
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
