import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageProvider";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

// Cast to any to bypass outdated database.types.ts (on_duty_state schema differs)
const supabase = supabaseClient as any;
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, UserCheck, UserX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GroupMember {
  user_id: string;
  full_name: string | null;
  email: string;
  is_on_duty: boolean;
  last_changed_at: string | null;
}

interface Group {
  id: string;
  name: string;
  members: GroupMember[];
}

export default function VaktlistePage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [groups, setGroups] = useState<Group[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserDuty, setCurrentUserDuty] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    setCurrentUserId(userId);

    // Load the current user's profile to get tenant_id
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      setLoading(false);
      return;
    }

    // Load all groups for this tenant
    const { data: groupRows, error: groupsError } = await supabase
      .from("groups")
      .select("id, name")
      .eq("tenant_id", profile.tenant_id)
      .order("name", { ascending: true });

    if (groupsError) {
      console.error("[vaktliste] Failed to load groups:", groupsError);
      toast({ title: t("vaktliste.error_loading"), variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!groupRows || groupRows.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = groupRows.map((g) => g.id);

    // Load all memberships for these groups
    const { data: memberships } = await supabase
      .from("group_memberships")
      .select("user_id, group_id")
      .in("group_id", groupIds);

    if (!memberships || memberships.length === 0) {
      setGroups(groupRows.map((g) => ({ ...g, members: [] })));
      setLoading(false);
      return;
    }

    const memberUserIds = [...new Set(memberships.map((m) => m.user_id))];

    // Load user profiles for all members
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", memberUserIds);

    // Load on_duty_state for all members
    const { data: dutyRows } = await supabase
      .from("on_duty_state")
      .select("user_id, is_on_duty, last_changed_at")
      .in("user_id", memberUserIds);

    type ProfileRow = { id: string; full_name: string | null; email: string };
    type DutyRow = { user_id: string; is_on_duty: boolean; last_changed_at: string | null };

    const typedProfiles = (profiles ?? []) as ProfileRow[];
    const typedDutyRows = (dutyRows ?? []) as DutyRow[];

    const profileMap = new Map(typedProfiles.map((p) => [p.id, p]));
    const dutyMap = new Map(
      typedDutyRows.map((d) => [d.user_id, { is_on_duty: d.is_on_duty, last_changed_at: d.last_changed_at }])
    );

    // Track current user's duty status
    const myDuty = dutyMap.get(userId);
    setCurrentUserDuty(myDuty?.is_on_duty ?? false);

    // Build groups with members
    const builtGroups: Group[] = groupRows.map((g) => {
      const memberIds = memberships.filter((m) => m.group_id === g.id).map((m) => m.user_id);
      const members: GroupMember[] = memberIds.map((uid) => {
        const p = profileMap.get(uid);
        const duty = dutyMap.get(uid);
        return {
          user_id: uid,
          full_name: p?.full_name ?? null,
          email: p?.email ?? uid,
          is_on_duty: duty?.is_on_duty ?? false,
          last_changed_at: duty?.last_changed_at ?? null,
        };
      });
      return { id: g.id, name: g.name, members };
    });

    setGroups(builtGroups);
    setLoading(false);
  }, [t, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription on on_duty_state
  useEffect(() => {
    const channel = supabase
      .channel("vaktliste-duty-state")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "on_duty_state" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const toggleDuty = async () => {
    if (!currentUserId) return;
    setToggling(true);
    const newStatus = !currentUserDuty;

    const { error } = await supabase
      .from("on_duty_state")
      .upsert(
        { user_id: currentUserId, is_on_duty: newStatus, last_changed_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("[vaktliste] Failed to toggle duty:", error);
      toast({ title: t("vaktliste.error_toggle"), variant: "destructive" });
    } else {
      setCurrentUserDuty(newStatus);
      toast({ title: t("vaktliste.updated") });
    }
    setToggling(false);
  };

  return (
    <AppLayout>
      <Head>
        <title>{t("vaktliste.title")} – SeMSe</title>
      </Head>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="h-6 w-6" />
            {t("vaktliste.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("vaktliste.subtitle")}</p>
        </div>

        {/* My duty toggle */}
        <Card>
          <CardContent className="pt-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">{t("vaktliste.your_status")}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {currentUserDuty ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    {t("vaktliste.on_duty")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t("vaktliste.off_duty")}</span>
                )}
              </div>
            </div>
            <Button
              onClick={toggleDuty}
              disabled={toggling}
              variant={currentUserDuty ? "outline" : "default"}
              className="min-w-[140px]"
            >
              {currentUserDuty ? t("vaktliste.go_off_duty") : t("vaktliste.go_on_duty")}
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-muted-foreground py-8 text-center">{t("vaktliste.loading")}</div>
        ) : groups.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">{t("vaktliste.no_groups")}</div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const onDutyCount = group.members.filter((m) => m.is_on_duty).length;
              return (
                <Card key={group.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{group.name}</span>
                      <Badge variant={onDutyCount > 0 ? "default" : "secondary"}>
                        {onDutyCount} {t("vaktliste.members_on_duty")}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {group.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("vaktliste.no_members")}</p>
                    ) : (
                      <ul className="space-y-2">
                        {group.members.map((member) => (
                          <li
                            key={member.user_id}
                            className="flex items-center justify-between py-1.5 border-b last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              {member.is_on_duty ? (
                                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <UserX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <div>
                                <div className="text-sm font-medium">
                                  {member.full_name || member.email}
                                </div>
                                {member.last_changed_at && (
                                  <div className="text-xs text-muted-foreground">
                                    {t("vaktliste.last_changed")}:{" "}
                                    {formatDistanceToNow(new Date(member.last_changed_at), {
                                      addSuffix: true,
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Badge variant={member.is_on_duty ? "default" : "secondary"}>
                              {member.is_on_duty ? t("vaktliste.on_duty") : t("vaktliste.off_duty")}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
