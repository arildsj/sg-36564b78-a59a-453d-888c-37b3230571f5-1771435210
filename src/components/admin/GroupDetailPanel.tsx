import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Group } from "@/services/groupService";

const db = supabase as any;

type Member = {
  user_id: string;
  is_active: boolean;
  full_name: string;
  phone: string;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

export function GroupDetailPanel({
  group,
  onRefresh,
}: {
  group: Group;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggleErrors, setToggleErrors] = useState<Record<string, string>>({});
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  const minActive: number = (group as any).min_active ?? 0;
  const activeCount = members.filter((m) => m.is_active).length;

  // Local copy of min_active for the editable field
  const [minActiveInput, setMinActiveInput] = useState(minActive);
  const [savingMinActive, setSavingMinActive] = useState(false);

  // Keep input in sync when parent refreshes group data
  useEffect(() => {
    setMinActiveInput((group as any).min_active ?? 0);
  }, [(group as any).min_active]);

  // ── Load members ──────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: gm, error: gmError } = await db
        .from("group_members")
        .select("user_id, is_active")
        .eq("group_id", group.id);

      if (gmError) throw gmError;

      if (!gm || gm.length === 0) {
        setMembers([]);
        return;
      }

      const userIds = gm.map((m: any) => m.user_id);

      const { data: profiles } = await db
        .from("user_profiles")
        .select("id, full_name, phone, email")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.id, p])
      );

      setMembers(
        gm.map((m: any) => {
          const p: any = profileMap.get(m.user_id) ?? {};
          return {
            user_id:   m.user_id,
            is_active: m.is_active ?? false,
            full_name: p.full_name || p.email || "Ukjent",
            phone:     p.phone || "—",
          };
        })
      );
    } catch (err: any) {
      toast({
        title: "Feil ved lasting av medlemmer",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // ── Activation toggle ────────────────────────────────────────────────
  const handleToggle = async (userId: string, setActive: boolean) => {
    // Client-side guard: prevent deactivation below min_active
    if (!setActive && activeCount - 1 < minActive) {
      setToggleErrors((prev) => ({
        ...prev,
        [userId]: `Kan ikke deaktivere — ville bragt aktive (${activeCount - 1}) under minimum (${minActive}).`,
      }));
      return;
    }

    setTogglingUser(userId);
    setToggleErrors((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/activation/admin-override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          group_id:       group.id,
          target_user_id: userId,
          set_active:     setActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setToggleErrors((prev) => ({
          ...prev,
          [userId]: err.error ?? "Ukjent feil",
        }));
      } else {
        await loadMembers();
        onRefresh();
      }
    } catch (err: any) {
      setToggleErrors((prev) => ({ ...prev, [userId]: err.message }));
    } finally {
      setTogglingUser(null);
    }
  };

  // ── Min active save ───────────────────────────────────────────────────
  const handleSaveMinActive = async () => {
    const oldVal = minActive;
    const newVal = minActiveInput;
    if (newVal === oldVal) return;

    if (
      !window.confirm(
        `Endre minimumsantall aktive fra ${oldVal} til ${newVal} for gruppen "${group.name}"?`
      )
    )
      return;

    setSavingMinActive(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/groups/${group.id}/min-active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ min_active: newVal }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Feil", description: err.error, variant: "destructive" });
      } else {
        toast({
          title: "Oppdatert",
          description: `Minimumsantall aktive er nå ${newVal}`,
        });
        onRefresh();
      }
    } catch (err: any) {
      toast({ title: "Feil", description: err.message, variant: "destructive" });
    } finally {
      setSavingMinActive(false);
    }
  };

  // ── Derived display flags ─────────────────────────────────────────────
  const showCounter = !(activeCount === 0 && minActive === 0);
  const atMin = minActive > 0 && activeCount <= minActive;

  return (
    <div className="space-y-4">
      {/* ── Counter + min_active editor ── */}
      {showCounter && (
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 pb-2 border-b">
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium">
              {activeCount} aktive / minimum {minActive}
            </p>
            {atMin && (
              <p className="text-xs text-yellow-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Ingen buffer — alle aktive er på vakt
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Maks. aktive
            </Label>
            <Input
              type="number"
              min={0}
              value={minActiveInput}
              onChange={(e) =>
                setMinActiveInput(Math.max(0, parseInt(e.target.value) || 0))
              }
              className="h-7 w-16 text-xs px-2"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={savingMinActive || minActiveInput === minActive}
              onClick={handleSaveMinActive}
              title="Lagre minimumsantall"
            >
              {savingMinActive ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Member list ── */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Ingen medlemmer i denne gruppen.
        </p>
      ) : (
        <div className="space-y-0.5">
          {members.map((m) => (
            <div key={m.user_id}>
              <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
                {/* Avatar */}
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0 select-none">
                  {initials(m.full_name)}
                </div>
                {/* Name + phone */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">{m.phone}</p>
                </div>
                {/* Active toggle */}
                <Switch
                  checked={m.is_active}
                  disabled={togglingUser === m.user_id}
                  onCheckedChange={(checked) => handleToggle(m.user_id, checked)}
                />
              </div>
              {/* Per-member inline error */}
              {toggleErrors[m.user_id] && (
                <p className="text-xs text-destructive flex items-center gap-1 px-2 pb-1 ml-10">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {toggleErrors[m.user_id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
