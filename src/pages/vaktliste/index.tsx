import React, { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageProvider";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CalendarClock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

// Cast to any to bypass outdated database.types.ts
const db = supabaseClient as any;

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupMember {
  membership_id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  is_active: boolean;
  last_active_at: string | null;
  is_admin: boolean;
}

interface Group {
  id: string;
  name: string;
  min_active: number;
  members: GroupMember[];
}

type ConfirmAction =
  | { type: "activate_other"; member: GroupMember; group: Group }
  | { type: "deactivate_other"; member: GroupMember; group: Group };

interface IncomingRequest {
  id: string;
  group_id: string;
  group_name: string;
  requester_name: string;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VaktlistePage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [groups, setGroups] = useState<Group[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // `${userId}_${groupId}` → activation_request id
  const [pendingMap, setPendingMap] = useState<Map<string, string>>(new Map());
  // Set of `${userId}_${groupId}` currently being written
  const [togglingSet, setTogglingSet] = useState<Set<string>>(new Set());
  // Which member/group is blocked from self-deactivating (min_active)
  const [blocked, setBlocked] = useState<{ userId: string; groupId: string } | null>(null);
  // Rejection messages: `${userId}_${groupId}` → text
  const [rejectionMap, setRejectionMap] = useState<Map<string, string>>(new Map());
  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  // Handover picker: blocked user picks who to ask
  const [handoverGroup, setHandoverGroup] = useState<Group | null>(null);
  // Incoming activation request modal (target user)
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [respondingToRequest, setRespondingToRequest] = useState(false);
  // Guard: only auto-show modal once on initial page load (not on every Realtime refresh)
  const hasShownInitialModalRef = useRef(false);

  // Refs for stable Realtime closures
  const currentUserIdRef = useRef<string | null>(null);
  const groupsRef = useRef<Group[]>([]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const {
      data: { session },
    } = await db.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    setCurrentUserId(userId);

    const { data: profileRow } = await db
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (!profileRow) {
      setLoading(false);
      return;
    }
    setTenantId(profileRow.tenant_id);
    setCurrentUserRole(profileRow.role ?? "member");

    const { data: groupRows, error: groupsErr } = await db
      .from("groups")
      .select("id, name, min_active")
      .eq("tenant_id", profileRow.tenant_id)
      .order("name", { ascending: true });

    if (groupsErr || !groupRows?.length) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = groupRows.map((g: any) => g.id);

    const { data: memberships } = await db
      .from("group_memberships")
      .select("id, user_id, group_id, is_active, last_active_at, is_admin")
      .in("group_id", groupIds);

    const memberUserIds = [
      ...new Set(((memberships ?? []) as any[]).map((m: any) => m.user_id)),
    ] as string[];

    const { data: profiles } =
      memberUserIds.length > 0
        ? await db
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", memberUserIds)
        : { data: [] };

    const profileMap = new Map(((profiles ?? []) as any[]).map((p: any) => [p.id, p]));

    // Pending activation_requests
    const { data: pendingReqs } = await db
      .from("activation_requests")
      .select("id, group_id, requested_user_ids, requester_id, status, resolved_by")
      .in("group_id", groupIds)
      .eq("status", "pending");

    const newPending = new Map<string, string>();
    ((pendingReqs ?? []) as any[]).forEach((req: any) => {
      ((req.requested_user_ids ?? []) as string[]).forEach((uid) => {
        newPending.set(`${uid}_${req.group_id}`, req.id);
      });
    });
    setPendingMap(newPending);

    // Check recently rejected requests so we can show inline messages
    const { data: rejectedReqs } = await db
      .from("activation_requests")
      .select("id, group_id, requested_user_ids, resolved_by")
      .in("group_id", groupIds)
      .eq("status", "rejected")
      .gte(
        "resolved_at",
        new Date(Date.now() - 60 * 1000).toISOString() // last 60 s
      );

    const newRejection = new Map<string, string>();
    ((rejectedReqs ?? []) as any[]).forEach((req: any) => {
      ((req.requested_user_ids ?? []) as string[]).forEach((uid) => {
        const resolverProfile = (profiles ?? []).find((p: any) => p.id === req.resolved_by);
        const resolverName = resolverProfile?.full_name || resolverProfile?.email || "Personen";
        newRejection.set(`${uid}_${req.group_id}`, `${resolverName} avslo forespørselen`);
      });
    });
    setRejectionMap(newRejection);

    const builtGroups: Group[] = groupRows.map((g: any) => {
      const gMemberships = ((memberships ?? []) as any[]).filter(
        (m: any) => m.group_id === g.id
      );
      const members: GroupMember[] = gMemberships.map((m: any) => {
        const p = profileMap.get(m.user_id) as any;
        return {
          membership_id: m.id,
          user_id: m.user_id,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,   // never fall back to raw UUID
          is_active: m.is_active ?? false,
          last_active_at: m.last_active_at ?? null,
          is_admin: m.is_admin ?? false,
        };
      });
      return { id: g.id, name: g.name, min_active: g.min_active ?? 0, members };
    });

    setGroups(builtGroups);
    groupsRef.current = builtGroups;

    // Page-load: if there's a pending request targeting the current user, auto-open modal once
    const myPendingReq = ((pendingReqs ?? []) as any[]).find(
      (req: any) =>
        Array.isArray(req.requested_user_ids) &&
        req.requested_user_ids.includes(userId)
    );
    if (myPendingReq && !hasShownInitialModalRef.current) {
      hasShownInitialModalRef.current = true;
      const grp = builtGroups.find((g) => g.id === myPendingReq.group_id);
      const requesterProfile = (profiles ?? []).find((p: any) => p.id === myPendingReq.requester_id) as any;
      setIncomingRequest({
        id: myPendingReq.id,
        group_id: myPendingReq.group_id,
        group_name: grp?.name ?? "ukjent gruppe",
        requester_name:
          requesterProfile?.full_name || requesterProfile?.email || "En annen bruker",
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep userId ref in sync
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Realtime: refresh on membership changes + intercept incoming activation requests
  useEffect(() => {
    const channel = db
      .channel("vaktliste-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_memberships" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activation_requests" },
        (payload: any) => {
          loadData();
          // Show modal if this INSERT targets the current user (sound handled by AppLayout)
          if (payload.eventType === "INSERT") {
            const req = payload.new;
            const uid = currentUserIdRef.current;
            if (uid && Array.isArray(req.requested_user_ids) && req.requested_user_ids.includes(uid)) {
              const grp = groupsRef.current.find((g) => g.id === req.group_id);
              const requesterMember = groupsRef.current
                .flatMap((g) => g.members)
                .find((m) => m.user_id === req.requester_id);
              setIncomingRequest({
                id: req.id,
                group_id: req.group_id,
                group_name: grp?.name ?? "ukjent gruppe",
                requester_name:
                  requesterMember?.full_name ||
                  requesterMember?.email ||
                  "En annen bruker",
              });
            }
          }
        }
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [loadData]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const addToggling = (key: string) =>
    setTogglingSet((prev) => new Set([...prev, key]));
  const removeToggling = (key: string) =>
    setTogglingSet((prev) => {
      const s = new Set(prev);
      s.delete(key);
      return s;
    });

  const logAudit = async (opts: {
    actorId: string;
    targetUserId: string;
    groupId: string;
    action: string;
    eventType: string;
    membershipId: string;
  }) => {
    await db.from("audit_log").insert({
      user_id: opts.actorId,
      target_user_id: opts.targetUserId,
      action: opts.action,
      resource_type: "group_membership",
      resource_id: opts.membershipId,
      event_type: opts.eventType,
      group_id: opts.groupId,
      tenant_id: tenantId,
    });
  };

  const optimisticUpdate = (groupId: string, userId: string, isActive: boolean) => {
    const now = new Date().toISOString();
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              members: g.members.map((m) =>
                m.user_id !== userId
                  ? m
                  : { ...m, is_active: isActive, last_active_at: now }
              ),
            }
      )
    );
  };

  // ── Toggle actions ──────────────────────────────────────────────────────────

  const toggleSelf = async (member: GroupMember, group: Group) => {
    if (!currentUserId) return;
    const key = `${member.user_id}_${group.id}`;
    const newActive = !member.is_active;

    if (!newActive) {
      const activeCount = group.members.filter((m) => m.is_active).length;
      if (activeCount <= group.min_active) {
        setBlocked({ userId: member.user_id, groupId: group.id });
        return;
      }
    }

    setBlocked(null);
    addToggling(key);

    const { error } = await db
      .from("group_memberships")
      .update({ is_active: newActive, last_active_at: new Date().toISOString() })
      .eq("id", member.membership_id);

    if (error) {
      console.error("[vaktliste] toggleSelf:", error);
      toast({ title: t("vaktliste.error_toggle"), variant: "destructive" });
    } else {
      optimisticUpdate(group.id, member.user_id, newActive);
      await logAudit({
        actorId: currentUserId,
        targetUserId: currentUserId,
        groupId: group.id,
        action: newActive ? "activate_self" : "deactivate_self",
        eventType: newActive ? "activated" : "deactivated",
        membershipId: member.membership_id,
      });
    }

    removeToggling(key);
  };

  const requestActivateOther = async (member: GroupMember, group: Group) => {
    if (!currentUserId || !tenantId) return;
    const key = `${member.user_id}_${group.id}`;
    setConfirmAction(null);
    addToggling(key);

    const { error } = await db.from("activation_requests").insert({
      group_id: group.id,
      requester_id: currentUserId,
      requested_user_ids: [member.user_id],
      message: null,
      status: "pending",
      tenant_id: tenantId,
    });

    if (error) {
      console.error("[vaktliste] requestActivateOther:", error);
      toast({ title: t("vaktliste.error_toggle"), variant: "destructive" });
    } else {
      await logAudit({
        actorId: currentUserId,
        targetUserId: member.user_id,
        groupId: group.id,
        action: "request_activation",
        eventType: "activation_requested",
        membershipId: member.membership_id,
      });
    }

    removeToggling(key);
    loadData();
  };

  const deactivateOther = async (member: GroupMember, group: Group) => {
    if (!currentUserId) return;
    // Enforce min_active for all roles — no bypass
    const activeCount = group.members.filter((m) => m.is_active).length;
    if (activeCount - 1 < group.min_active) {
      toast({
        title: "Ikke tillatt",
        description: `Kan ikke deaktivere — ville bragt aktive (${activeCount - 1}) under minimumsantallet (${group.min_active}).`,
        variant: "destructive",
      });
      setConfirmAction(null);
      return;
    }

    const key = `${member.user_id}_${group.id}`;
    setConfirmAction(null);
    addToggling(key);

    const { error } = await db
      .from("group_memberships")
      .update({ is_active: false, last_active_at: new Date().toISOString() })
      .eq("id", member.membership_id);

    if (error) {
      console.error("[vaktliste] deactivateOther:", error);
      toast({ title: t("vaktliste.error_toggle"), variant: "destructive" });
    } else {
      optimisticUpdate(group.id, member.user_id, false);
      await logAudit({
        actorId: currentUserId,
        targetUserId: member.user_id,
        groupId: group.id,
        action: "deactivate_other",
        eventType: "deactivated",
        membershipId: member.membership_id,
      });
    }

    removeToggling(key);
  };

  // ── Activation request responses (incoming modal) ───────────────────────────

  const respondToRequest = async (response: "accepted" | "rejected") => {
    if (!incomingRequest || respondingToRequest) return;
    setRespondingToRequest(true);
    try {
      const { data: { session } } = await db.auth.getSession();
      const res = await fetch("/api/activation/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ request_id: incomingRequest.id, response }),
      });
      if (!res.ok && response === "accepted") {
        const err = await res.json();
        toast({ title: "Feil", description: err.error, variant: "destructive" });
      } else if (response === "accepted") {
        toast({ title: t("vaktliste.on_duty"), description: `Du er nå på vakt i ${incomingRequest.group_name}` });
      }
      setIncomingRequest(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Feil", description: e.message, variant: "destructive" });
    } finally {
      setRespondingToRequest(false);
    }
  };

  // ── Main toggle dispatcher ──────────────────────────────────────────────────

  const handleToggle = (member: GroupMember, group: Group) => {
    const key = `${member.user_id}_${group.id}`;
    const isSelf = member.user_id === currentUserId;
    // Self can always toggle their own status; pending only blocks others
    if (togglingSet.has(key) || (!isSelf && pendingMap.has(key))) return;

    if (isSelf) {
      toggleSelf(member, group);
    } else if (!member.is_active) {
      // Request another person to go on duty
      setConfirmAction({ type: "activate_other", member, group });
    } else {
      // Turn another person off — admins only
      const isAdmin =
        currentUserRole === "tenant_admin" || currentUserRole === "group_admin";
      if (!isAdmin) {
        toast({
          title: "Ikke tillatt",
          description: "Kun gruppeadmins kan ta andre av vakt.",
          variant: "destructive",
        });
        return;
      }
      setConfirmAction({ type: "deactivate_other", member, group });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

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

        {loading ? (
          <div className="text-muted-foreground py-8 text-center">
            {t("vaktliste.loading")}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            {t("vaktliste.no_groups")}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const activeCount = group.members.filter((m) => m.is_active).length;
              return (
                <Card key={group.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{group.name}</span>
                      <Badge variant={activeCount > 0 ? "default" : "secondary"}>
                        {activeCount} {t("vaktliste.members_on_duty")}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {group.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("vaktliste.no_members")}
                      </p>
                    ) : (
                      <ul className="space-y-0">
                        {group.members.map((member) => {
                          const key = `${member.user_id}_${group.id}`;
                          const isSelf = member.user_id === currentUserId;
                          const isPending = pendingMap.has(key);
                          const isToggling = togglingSet.has(key);
                          const isBlocked =
                            blocked?.userId === member.user_id &&
                            blocked?.groupId === group.id;
                          const rejection = rejectionMap.get(key);

                          return (
                            <li key={member.user_id}>
                              <div className="flex items-center justify-between py-3 border-b last:border-0 gap-3">
                                {/* Left: name + timestamp */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {(isPending || isToggling) && (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                                      <span className="truncate">
                                        {member.full_name || member.email || "Ukjent bruker"}
                                      </span>
                                      {isSelf && (
                                        <span className="text-xs text-muted-foreground font-normal">
                                          (deg)
                                        </span>
                                      )}
                                      {isPending && (
                                        <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">
                                          · Venter på bekreftelse...
                                        </span>
                                      )}
                                    </div>
                                    {member.last_active_at && (
                                      <div className="text-xs text-muted-foreground">
                                        {t("vaktliste.last_changed")}:{" "}
                                        {formatDistanceToNow(
                                          new Date(member.last_active_at),
                                          { addSuffix: true, locale: nb }
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right: toggle */}
                                <Switch
                                  checked={member.is_active}
                                  onCheckedChange={() => handleToggle(member, group)}
                                  disabled={isToggling || (isPending && !isSelf)}
                                  className={cn(
                                    "transition-opacity flex-shrink-0",
                                    (isPending || isToggling) && "opacity-40",
                                    "data-[state=checked]:bg-green-500 dark:data-[state=checked]:bg-green-500"
                                  )}
                                  aria-label={`${member.full_name || member.email} – ${
                                    member.is_active
                                      ? t("vaktliste.on_duty")
                                      : t("vaktliste.off_duty")
                                  }`}
                                />
                              </div>

                              {/* Min-active block message */}
                              {isBlocked && (
                                <div className="pt-1 pb-3 space-y-2">
                                  <p className="text-sm text-destructive">
                                    Du kan ikke gå av vakt uten at noen overtar.
                                    Send en forespørsel til en annen i gruppen.
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setHandoverGroup(group)}
                                  >
                                    Send forespørsel om vaktbytte →
                                  </Button>
                                </div>
                              )}

                              {/* Rejection message */}
                              {rejection && !isBlocked && (
                                <div className="pt-0.5 pb-2 text-xs text-muted-foreground">
                                  {rejection}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Confirm dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "activate_other"
                ? `Sett ${
                    confirmAction.member.full_name || confirmAction.member.email || "Ukjent"
                  } på vakt i ${confirmAction.group.name}?`
                : `Ta ${
                    confirmAction?.member.full_name || confirmAction?.member.email || "Ukjent"
                  } av vakt i ${confirmAction?.group.name}?`}
            </DialogTitle>
          </DialogHeader>

          {confirmAction?.type === "activate_other" && (
            <p className="text-sm text-muted-foreground">
              Det sendes en forespørsel til personen om å bekrefte vakten. Toggloen
              vises som ventende til personen svarer (maks 10 min).
            </p>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Avbryt
            </Button>
            <Button
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "activate_other") {
                  requestActivateOther(confirmAction.member, confirmAction.group);
                } else {
                  deactivateOther(confirmAction.member, confirmAction.group);
                }
              }}
            >
              {confirmAction?.type === "activate_other"
                ? "Ja, send forespørsel"
                : "Ja, ta av vakt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Handover picker (blocked self-deactivation) ──────────────────── */}
      <Dialog open={!!handoverGroup} onOpenChange={(open) => { if (!open) setHandoverGroup(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hvem skal ta over vakten?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Velg hvem du vil be om å ta over vakten i{" "}
            <strong>{handoverGroup?.name}</strong>.
          </p>
          <div className="space-y-1">
            {handoverGroup?.members
              .filter((m) => m.user_id !== currentUserId && !m.is_active)
              .map((m) => (
                <Button
                  key={m.user_id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    if (handoverGroup) {
                      requestActivateOther(m, handoverGroup);
                      setHandoverGroup(null);
                      setBlocked(null);
                    }
                  }}
                >
                  {m.full_name || m.email || "Ukjent bruker"}
                </Button>
              ))}
            {handoverGroup?.members.filter(
              (m) => m.user_id !== currentUserId && !m.is_active
            ).length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Ingen andre inaktive medlemmer i gruppen.
              </p>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setHandoverGroup(null)}>
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Incoming activation request modal ────────────────────────────── */}
      <Dialog
        open={!!incomingRequest}
        onOpenChange={(open) => { if (!open && !respondingToRequest) setIncomingRequest(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("vaktliste.request_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            {t("vaktliste.request_body")
              .replace("{name}", incomingRequest?.requester_name ?? "")
              .replace("{group}", incomingRequest?.group_name ?? "")}
          </p>
          <DialogFooter className="gap-2 flex-col sm:flex-row mt-2">
            <Button
              variant="outline"
              disabled={respondingToRequest}
              onClick={() => respondToRequest("rejected")}
            >
              {t("vaktliste.reject")}
            </Button>
            <Button
              disabled={respondingToRequest}
              onClick={() => respondToRequest("accepted")}
            >
              {respondingToRequest ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("vaktliste.accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
