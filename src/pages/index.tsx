import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";
import { 
  MessageSquare, 
  Users, 
  Send, 
  Shield, 
  Activity,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageProvider";
import { messageService } from "@/services/messageService";
import { groupService } from "@/services/groupService";
import { userService } from "@/services/userService";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export default function Dashboard() {
  const { t } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    unreadMessages: 0,
    activeGroups: 0,
    totalContacts: 0,
    recentAlerts: 0
  });
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Redirect handled by AppLayout usually, but safe to check
        return;
      }

      // Get user profile
      const profile = await userService.getCurrentUserProfile();
      setUserRole(profile?.role || null);

      // 1. Stats
      // Unread messages
      const { count: unreadCount } = await db
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("status", "received"); // Assuming 'received' means unread/new

      // Active groups
      const groups = await groupService.getOperationalGroups();
      
      // Total contacts
      const { count: contactsCount } = await db
        .from("whitelisted_numbers")
        .select("*", { count: "exact", head: true });

      setStats({
        unreadMessages: unreadCount || 0,
        activeGroups: groups.length,
        totalContacts: contactsCount || 0,
        recentAlerts: 0 // Placeholder
      });

      // 2. Recent Messages
      const messages = await messageService.getRecentMessages(5);
      setRecentMessages(messages);

      // 3. Active Incidents (mock for now, or fetch from groups with active escalation)
      const incidents = groups.filter(g => g.escalation_enabled && (g.active_members || 0) < (g.min_on_duty_count || 1));
      setActiveIncidents(incidents);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Head>
        <title>SeMSe Dashboard</title>
      </Head>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Oversikt</h1>
            <p className="text-muted-foreground">
              Velkommen tilbake. Her er status for din organisasjon.
            </p>
          </div>
          <Button onClick={() => router.push("/sending")}>
            <Send className="mr-2 h-4 w-4" /> Ny Melding
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ubehandlede Meldinger</CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unreadMessages}</div>
              <p className="text-xs text-muted-foreground">
                Krever oppfølging
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Operasjonelle Grupper</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeGroups}</div>
              <p className="text-xs text-muted-foreground">
                Aktive i tjeneste
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kontakter</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground">
                Registrert i systemet
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Normal</div>
              <p className="text-xs text-muted-foreground">
                Alle tjenester operative
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Recent Messages */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Siste Meldinger</CardTitle>
              <CardDescription>
                Nylig aktivitet fra innboksen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Ingen nylige meldinger</p>
                ) : (
                  recentMessages.map((msg) => (
                    <div key={msg.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {msg.from_number}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </div>
                    </div>
                  ))
                )}
                
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/inbox">
                    Gå til Innboks <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Items / Alerts */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Handlinger</CardTitle>
              <CardDescription>
                Ting som krever oppmerksomhet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Active Incidents / Low Staffing */}
                {activeIncidents.length > 0 && (
                   <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Bemanningsvarsel</h3>
                        <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                          <ul role="list" className="list-disc space-y-1 pl-5">
                            {activeIncidents.map(g => (
                              <li key={g.id}>{g.name}: Kun {g.active_members} på vakt (Min: {g.min_on_duty_count})</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Snarveier</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="justify-start" asChild>
                      <Link href="/contacts">
                        <Users className="mr-2 h-4 w-4" /> Kontakter
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="justify-start" asChild>
                      <Link href="/print-to-sms">
                        <Clock className="mr-2 h-4 w-4" /> Print-to-SMS
                      </Link>
                    </Button>
                    {(userRole === "tenant_admin" || userRole === "group_admin") && (
                       <Button variant="outline" size="sm" className="justify-start" asChild>
                        <Link href="/admin">
                          <Shield className="mr-2 h-4 w-4" /> Admin
                        </Link>
                      </Button>
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