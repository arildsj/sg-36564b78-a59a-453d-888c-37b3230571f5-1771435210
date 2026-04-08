import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { routingRuleService, type RoutingRule, type EscalationLevel, type NormalizedEscalationLevel } from "@/services/routingRuleService";
import { groupService } from "@/services/groupService";
import { gatewayService, type Gateway } from "@/services/gatewayService";
import { Loader2, Plus, Trash2, MessageSquare, Globe, GripVertical, Pencil, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type MatchType = "keyword" | "prefix" | "fallback" | "sender";

const emptyRule = {
  name: "",
  match_type: "keyword" as MatchType,
  match_value: "",
  target_group_id: "",
  gateway_id: "",
  priority: 0,
};

const emptyEscalationLevel = (level: number): EscalationLevel => ({
  level,
  timeout_minutes: 30,
  methods: ["sms"],
  target_group_id: "",
});

// Returns true if the form differs from its initial snapshot
function isDirty(
  current: typeof emptyRule,
  initial: typeof emptyRule,
  currentLevels: EscalationLevel[],
  initialLevels: EscalationLevel[]
): boolean {
  return (
    JSON.stringify(current) !== JSON.stringify(initial) ||
    JSON.stringify(currentLevels) !== JSON.stringify(initialLevels)
  );
}

export function RoutingRulesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formRule, setFormRule] = useState({ ...emptyRule });
  const [escalationLevels, setEscalationLevels] = useState<EscalationLevel[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Snapshot for dirty-check (set when modal opens)
  const initialFormRule = useRef({ ...emptyRule });
  const initialEscalation = useRef<EscalationLevel[]>([]);

  // Drag-to-reorder
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rulesData, groupsData, gatewaysData] = await Promise.all([
        routingRuleService.getRules(),
        groupService.getGroups(),
        gatewayService.getAll(),
      ]);
      setRules(rulesData);
      setGroups(groupsData);
      setGateways(gatewaysData);
    } catch (error: any) {
      toast({ title: "Feil ved lasting", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Modal open/close ──────────────────────────────────────────────────
  const openNew = () => {
    const rule = { ...emptyRule };
    const levels: EscalationLevel[] = [];
    setEditingId(null);
    setFormRule(rule);
    setEscalationLevels(levels);
    setSaveError(null);
    initialFormRule.current = { ...rule };
    initialEscalation.current = [];
    setModalOpen(true);
  };

  const openEdit = (rule: RoutingRule) => {
    const form = {
      name:            rule.name || "",
      match_type:      (rule.match_type as MatchType) || "keyword",
      match_value:     rule.match_value || "",
      target_group_id: rule.target_group_id || "",
      gateway_id:      rule.gateway_id || "",
      priority:        rule.priority ?? 0,
    };
    const levels = rule.escalation_config ? [...rule.escalation_config] : [];
    setEditingId(rule.id);
    setFormRule(form);
    setEscalationLevels(levels);
    setSaveError(null);
    initialFormRule.current = { ...form };
    initialEscalation.current = JSON.parse(JSON.stringify(levels));
    setModalOpen(true);
  };

  const requestClose = () => {
    const dirty = isDirty(
      formRule,
      initialFormRule.current,
      escalationLevels,
      initialEscalation.current
    );
    if (dirty && !window.confirm("Du har ulagrede endringer. Lukke likevel?")) return;
    closeModal();
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormRule({ ...emptyRule });
    setEscalationLevels([]);
    setSaveError(null);
    setSaving(false);
  };

  // ── Validation ────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!formRule.name.trim()) return "Regelnavn er påkrevd.";
    if (formRule.match_type !== "fallback" && !formRule.match_value.trim())
      return "Matchverdi er påkrevd for valgt regeltype.";
    if (!formRule.target_group_id) return "Velg en målgruppe.";
    if (!formRule.gateway_id) return "Velg en gateway.";

    for (let i = 0; i < escalationLevels.length; i++) {
      const l = escalationLevels[i];
      if (!l.timeout_minutes || l.timeout_minutes < 1)
        return `Eskaleringsnivå ${i + 1}: minutter må være ≥ 1.`;
      if (l.methods.length === 0)
        return `Eskaleringsnivå ${i + 1}: velg minst én varslingsmetode.`;
    }

    return null;
  };

  const hasFallbackConflict = (): boolean => {
    if (formRule.match_type !== "fallback" || !formRule.gateway_id) return false;
    return rules.some(
      r => r.match_type === "fallback" &&
           r.gateway_id === formRule.gateway_id &&
           r.is_active &&
           r.id !== editingId
    );
  };

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSaveRule = async () => {
    setSaveError(null);

    const validationError = validate();
    if (validationError) { setSaveError(validationError); return; }
    if (hasFallbackConflict()) {
      setSaveError("Det finnes allerede en aktiv fallback-regel for valgt gateway. Deaktiver den først.");
      return;
    }

    setSaving(true);
    try {
      const escalationConfig = escalationLevels.length > 0 ? escalationLevels : null;

      if (editingId) {
        await routingRuleService.updateRule(editingId, {
          name:              formRule.name,
          match_type:        formRule.match_type,
          match_value:       formRule.match_value,
          target_group_id:   formRule.target_group_id,
          gateway_id:        formRule.gateway_id,
          priority:          formRule.priority,
          escalation_config: escalationConfig,
        });
        toast({ title: "Regel oppdatert" });
      } else {
        await routingRuleService.createRule({
          ...formRule,
          priority:          rules.length,
          is_active:         true,
          escalation_config: escalationConfig,
        });
        toast({ title: "Regel opprettet" });
      }

      closeModal();
      fetchData();
    } catch (err: any) {
      setSaveError(err?.message ?? (editingId ? "Kunne ikke oppdatere regel." : "Kunne ikke opprette regel."));
    } finally {
      setSaving(false);
    }
  };

  // ── Escalation level helpers ──────────────────────────────────────────
  const addEscalationLevel = () => {
    if (escalationLevels.length >= 3) return;
    setEscalationLevels(prev => [...prev, emptyEscalationLevel(prev.length + 1)]);
  };

  const removeEscalationLevel = (index: number) => {
    setEscalationLevels(prev =>
      prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, level: i + 1 }))
    );
  };

  const updateEscalationLevel = (index: number, changes: Partial<EscalationLevel>) => {
    setEscalationLevels(prev =>
      prev.map((l, i) => i === index ? { ...l, ...changes } : l)
    );
  };

  const toggleMethod = (index: number, method: "sms" | "push" | "voicecall") => {
    const level = escalationLevels[index];
    const methods = level.methods.includes(method)
      ? level.methods.filter(m => m !== method)
      : [...level.methods, method];
    updateEscalationLevel(index, { methods });
  };

  // ── Delete / toggle ───────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await routingRuleService.deleteRule(id);
      toast({ title: "Regel slettet" });
      fetchData();
    } catch {
      toast({ title: "Feil", description: "Kunne ikke slette regel", variant: "destructive" });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await routingRuleService.updateRule(id, { is_active: isActive });
      fetchData();
    } catch {
      toast({ title: "Feil", description: "Kunne ikke oppdatere regel", variant: "destructive" });
    }
  };

  // ── Drag-to-reorder ───────────────────────────────────────────────────
  const handleDragStart = (index: number) => { dragIndex.current = index; };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (targetIndex: number) => {
    const from = dragIndex.current;
    if (from === null || from === targetIndex) {
      dragIndex.current = null;
      setDragOverIndex(null);
      return;
    }
    const reordered = [...rules];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(targetIndex, 0, moved);
    setRules(reordered);
    dragIndex.current = null;
    setDragOverIndex(null);
    try {
      await routingRuleService.reorderRules(reordered.map(r => r.id));
    } catch {
      toast({ title: "Feil", description: "Kunne ikke lagre ny rekkefølge", variant: "destructive" });
      fetchData();
    }
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const escalationSummary = (rule: RoutingRule): string | null => {
    const levels = rule.escalation_levels_data;
    if (!levels || levels.length === 0) return null;
    return levels
      .map(l => {
        const methods = l.methods
          .map(m => m === "sms" ? "SMS" : m === "push" ? "App" : "Voice")
          .join(" + ");
        return `Nivå ${l.level_number}: ${l.minutes_without_reply} min → ${methods}`;
      })
      .join("   |   ");
  };

  const matchTypeBadgeClass = (type: string) => {
    switch (type) {
      case "keyword":  return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
      case "prefix":   return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300";
      case "sender":   return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300";
      case "fallback": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300";
      default:         return "bg-muted text-muted-foreground";
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* ── Rules list ── */}
      <div className="space-y-1.5">
        {rules.length === 0 ? (
          <div className="text-center py-10 border rounded-lg border-dashed text-muted-foreground text-sm">
            Ingen rutingsregler definert ennå
          </div>
        ) : (
          rules.map((rule, index) => (
            <div
              key={rule.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-default ${
                dragOverIndex === index
                  ? "bg-accent border-accent-foreground/30"
                  : "bg-secondary/20"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-background p-1 rounded-full border shrink-0 cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                    {rule.name || "Navnløs regel"}
                    <span className={`inline-flex items-center rounded border px-1 py-0 text-xs font-mono leading-4 ${matchTypeBadgeClass(rule.match_type)}`}>
                      {rule.match_type}
                    </span>
                    {rule.match_value && (
                      <span className="font-mono text-xs text-muted-foreground">{rule.match_value}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="h-3 w-3 shrink-0" />
                      {rule.group_name || "Ukjent gruppe"}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Globe className="h-3 w-3 shrink-0" />
                      {rule.gateway_name || "Ukjent gateway"}
                    </span>
                  </div>
                  {escalationSummary(rule) && (
                    <div className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                      <span>⚡</span>
                      <span>{escalationSummary(rule)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openEdit(rule)}
                  title="Rediger regel"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={(checked) => handleToggleActive(rule.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(rule.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 border-dashed"
          onClick={openNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          Ny rutingsregel
        </Button>
      </div>

      {/* ── Create / Edit dialog ── */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => { if (!open) requestClose(); }}
      >
        <DialogContent className="max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Rediger rutingsregel" : "Ny rutingsregel"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">

            {/* ── Section 1: Rule basics ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Navn på regel <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="F.eks. Support"
                  value={formRule.name}
                  onChange={(e) => setFormRule({ ...formRule, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Type regel <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formRule.match_type}
                  onValueChange={(value: any) =>
                    setFormRule({ ...formRule, match_type: value, match_value: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sender">Kjent avsender</SelectItem>
                    <SelectItem value="prefix">Prefiks (Starter med)</SelectItem>
                    <SelectItem value="keyword">Nøkkelord (Inneholder)</SelectItem>
                    <SelectItem value="fallback">Fallback (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Match value — label and visibility driven by type */}
            {formRule.match_type === "sender" && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Avsender-ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="'+4799887766' eller 'Kraftverk-AS'"
                  value={formRule.match_value}
                  maxLength={11}
                  onChange={(e) => setFormRule({ ...formRule, match_value: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Tlf. (+47…) eller alfanumerisk ID (maks 11 tegn).
                </p>
              </div>
            )}

            {formRule.match_type === "prefix" && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Prefiks <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="f.eks. 'START'"
                  value={formRule.match_value}
                  onChange={(e) => setFormRule({ ...formRule, match_value: e.target.value })}
                />
              </div>
            )}

            {formRule.match_type === "keyword" && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Nøkkelord <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="f.eks. 'hjelp'"
                  value={formRule.match_value}
                  onChange={(e) => setFormRule({ ...formRule, match_value: e.target.value })}
                />
              </div>
            )}

            {/* Fallback conflict warning */}
            {hasFallbackConflict() && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Det finnes allerede en aktiv fallback-regel for valgt gateway. Deaktiver den først.
              </p>
            )}

            {/* Group + gateway */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Send til gruppe <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formRule.target_group_id}
                  onValueChange={(value) => setFormRule({ ...formRule, target_group_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Velg gruppe" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Bruk gateway <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formRule.gateway_id}
                  onValueChange={(value) => setFormRule({ ...formRule, gateway_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Velg gateway" />
                  </SelectTrigger>
                  <SelectContent>
                    {gateways.map((gw) => (
                      <SelectItem key={gw.id} value={gw.id}>
                        {gw.name} ({gw.gw_phone || "Ingen telefon"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Section 2: Escalation levels ── */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Eskaleringsnivåer</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={escalationLevels.length >= 3}
                  onClick={addEscalationLevel}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Legg til nivå
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Varsle andre grupper hvis meldingen ikke besvares innen angitt tid.
              </p>

              {escalationLevels.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Ingen eskaleringsnivåer lagt til ennå.
                </p>
              )}

              {escalationLevels.map((level, index) => {
                const methodError = level.methods.length === 0;
                const minutesError = !level.timeout_minutes || level.timeout_minutes < 1;
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 border rounded-md px-2 py-2 bg-muted/20 flex-wrap ${
                      (methodError || minutesError) && saveError ? "border-destructive/50" : ""
                    }`}
                  >
                    <Badge variant="outline" className="font-mono text-xs h-5 px-1.5 shrink-0">
                      Nivå {level.level}
                    </Badge>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Etter</span>
                      <Input
                        type="number"
                        min={1}
                        value={level.timeout_minutes}
                        onChange={(e) =>
                          updateEscalationLevel(index, { timeout_minutes: parseInt(e.target.value) || 1 })
                        }
                        className={`h-6 w-14 text-xs px-1.5 ${minutesError && saveError ? "border-destructive" : ""}`}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">min</span>
                    </div>
                    <Select
                      value={level.target_group_id}
                      onValueChange={(value) => updateEscalationLevel(index, { target_group_id: value })}
                    >
                      <SelectTrigger className="h-6 text-xs w-36">
                        <SelectValue placeholder="Velg gruppe" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className={`flex items-center gap-2 ${methodError && saveError ? "ring-1 ring-destructive/50 rounded px-1" : ""}`}>
                      {(["sms", "push", "voicecall"] as const).map((method) => (
                        <label
                          key={method}
                          className="flex items-center gap-1 cursor-pointer select-none text-xs whitespace-nowrap"
                        >
                          <Checkbox
                            checked={level.methods.includes(method)}
                            onCheckedChange={() => toggleMethod(index, method)}
                            className="h-3.5 w-3.5"
                          />
                          {method === "sms" ? "SMS" : method === "push" ? "App-varsel" : "Voicecall"}
                        </label>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-auto shrink-0"
                      onClick={() => removeEscalationLevel(index)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* ── Inline save error ── */}
            {saveError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{saveError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={saving}>
              Avbryt
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={saving || hasFallbackConflict()}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Lagre endringer" : "Opprett regel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
