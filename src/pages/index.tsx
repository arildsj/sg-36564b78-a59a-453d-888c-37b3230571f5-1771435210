import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, Users, Clock, AlertCircle } from "lucide-react";
import { groupService } from "@/services/groupService";
import { messageService } from "@/services/messageService";
import { userService } from "@/services/userService";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageProvider";

type DashboardStats = {
  unacknowledged: number;
  operationalGroups: number;
  onDutyUsers: number;
  avgResponseTime: string;
};

type RecentMessage = {
  id: string;
  from_number: string;
  content: string;
  created_at: string;
  is_acknowledged: boolean;
};

type GroupStatus = {
  id: string;
  name: string;
  on_duty_count: number;
};

export default function HomePage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    unacknowledged: 0,
    operationalGroups: 0,
    onDutyUsers: 0,
    avgResponseTime: "—",
  });
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [groupStatuses, setGroupStatuses] = useState<GroupStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  /**
   * Calculate average response time for acknowledged messages in the last 24 hours
   * Response time = time between inbound message and first outbound reply in same thread
   */
  const calculateAverageResponseTime = async (): Promise<string> => {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Get all inbound messages from last 24 hours that have been acknowledged
      const { data: inboundMessages, error: inboundError } = await supabase
        .from("messages")
        .select("id, thread_key, created_at, acknowledged_at")
        .eq("direction", "inbound")
        .not("acknowledged_at", "is", null)
        .gte("created_at", twentyFourHoursAgo.toISOString())
        .order("created_at", { ascending: false });

      if (inboundError) {
        console.error("Error fetching inbound messages:", inboundError);
        return "—";
      }

      if (!inboundMessages || inboundMessages.length === 0) {
        return "—";
      }

      let totalResponseTime = 0;
      let responseCount = 0;

      // For each inbound message, find the first outbound reply
      for (const inbound of inboundMessages) {
        const { data: outboundReply, error: outboundError } = await supabase
          .from("messages")
          .select("created_at")
          .eq("thread_key", inbound.thread_key)
          .eq("direction", "outbound")
          .gte("created_at", inbound.created_at)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (outboundError) {
          console.error("Error fetching outbound reply:", outboundError);
          continue;
        }

        if (outboundReply) {
          const inboundTime = new Date(inbound.created_at).getTime();
          const outboundTime = new Date(outboundReply.created_at).getTime();
          const responseTimeMinutes = (outboundTime - inboundTime) / (1000 * 60);
          
          totalResponseTime += responseTimeMinutes;
          responseCount++;
        }
      }

      if (responseCount === 0) {
        return "—";
      }

      const avgMinutes = Math.round(totalResponseTime / responseCount);
      
      if (avgMinutes < 60) {
        return `${avgMinutes} min`;
      } else {
        const hours = Math.floor(avgMinutes / 60);
        const minutes = avgMinutes % 60;
        return minutes > 0 ? `${hours}t ${minutes}m` : `${hours}t`;
      }
    } catch (error) {
      console.error("Error calculating average response time:", error);
      return "—";
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load unacknowledged messages
      const unackMessages = await messageService.getUnacknowledgedMessages();
      
      // Load operational groups
      const groups = await groupService.getOperationalGroups();

      // Count on-duty users across all groups
      let totalOnDuty = 0;
      const groupStatusData: GroupStatus[] = [];
      
      for (const group of groups) {
        const onDutyUsers = await userService.getOnDutyUsersForGroup(group.id);
        totalOnDuty += onDutyUsers.length;
        groupStatusData.push({
          id: group.id,
          name: group.name,
          on_duty_count: onDutyUsers.length,
        });
      }

      // Get recent messages (limit to 5)
      const messages = unackMessages.slice(0, 5).map(msg => ({
        id: msg.id,
        from_number: msg.from_number,
        content: msg.content,
        created_at: msg.created_at,
        is_acknowledged: msg.is_acknowledged,
      }));

      // Calculate average response time
      const avgResponseTime = await calculateAverageResponseTime();

      setStats({
        unacknowledged: unackMessages.length,
        operationalGroups: groups.length,
        onDutyUsers: totalOnDuty,
        avgResponseTime,
      });

      setRecentMessages(messages);
      setGroupStatuses(groupStatusData);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "nå";
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}t siden`;
    return `${diffDays}d siden`;
  };

  return (
    <>
      <Head>
        <title>{t("dashboard.title")} - SeMSe 2.0</title>
        <meta name="description" content={t("dashboard.description")} />
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("dashboard.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/inbox" className="block">
              <Card className="border-2 hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.unhandled_messages")}</CardTitle>
                  <Inbox className="h-5 w-5 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {loading ? "..." : stats.unacknowledged}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.awaiting_confirmation")}
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin" className="block">
              <Card className="border-2 hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.operational_groups")}</CardTitle>
                  <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {loading ? "..." : stats.operationalGroups}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.active_inboxes")}
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin" className="block">
              <Card className="border-2 hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.on_duty_users")}</CardTitle>
                  <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {loading ? "..." : stats.onDutyUsers}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.active_operators")}
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin" className="block">
              <Card className="border-2 hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.avg_response_time")}</CardTitle>
                  <AlertCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stats.avgResponseTime}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.last_24h")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.recent_messages")}</CardTitle>
                <CardDescription>
                  {t("dashboard.newest_inbound")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    <p className="text-muted-foreground text-center py-8">{t("common.loading")}</p>
                  ) : recentMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground">{t("dashboard.no_messages")}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentMessages.map((msg) => (
                        <Link href="/inbox" key={msg.id} className="block group">
                          <div className="flex items-start justify-between border-b pb-3 group-hover:bg-muted/50 p-2 rounded transition-colors -mx-2">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{msg.from_number}</p>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {msg.content}
                              </p>
                            </div>
                            <Badge 
                              variant={msg.is_acknowledged ? "outline" : "destructive"} 
                              className="ml-2"
                            >
                              {formatTimeAgo(msg.created_at)}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  <Link href="/inbox">
                    <Button variant="outline" className="w-full mt-4">
                      {t("dashboard.see_all_messages")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.duty_status")}</CardTitle>
                <CardDescription>
                  {t("dashboard.on_duty_coverage")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    <p className="text-muted-foreground text-center py-8">{t("common.loading")}</p>
                  ) : groupStatuses.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground">{t("dashboard.no_operational_groups")}</p>
                      <Link href="/admin">
                        <Button variant="outline" className="mt-4">
                          {t("dashboard.create_first_group")}
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupStatuses.slice(0, 5).map((group) => (
                        <Link href="/admin" key={group.id} className="block group">
                          <div className="flex items-center justify-between border-b pb-3 group-hover:bg-muted/50 p-2 rounded transition-colors -mx-2">
                            <div>
                              <p className="font-medium text-foreground">{group.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {group.on_duty_count} {t("dashboard.on_duty")}
                              </p>
                            </div>
                            <Badge variant={group.on_duty_count > 0 ? "default" : "outline"}>
                              {group.on_duty_count > 0 ? t("dashboard.open") : t("dashboard.closed")}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  <Link href="/admin">
                    <Button variant="outline" className="w-full mt-4">
                      {t("dashboard.manage_groups")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </>
  );
}