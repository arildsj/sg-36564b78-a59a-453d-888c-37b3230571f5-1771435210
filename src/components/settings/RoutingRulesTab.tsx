import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { routingRuleService, type RoutingRule, type EscalationLevel } from "@/services/routingRuleService";
import { groupService } from "@/services/groupService";
import { gatewayService, type Gateway } from "@/services/gatewayService";
import { Loader2, Plus, Trash2, ArrowDownUp, MessageSquare, Globe, GripVertical, Pencil, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RoutingRulesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<{
    name: string;
    match_type: "keyword" | "prefix" | "fallback" | "sender";
    match_value: string;
    target_group_id: string;
    gateway_id: string;
    priority: number;
  }>({
    name: "",
    match_type: "keyword",
    match_value: "",
    target_group_id: "",
    gateway_id: "",
    priority: 0,
  });

  const [escalationLevels, setEscalationLevels] = useState<EscalationLevel[]>([]);

  const emptyRule = {
    name: "",
    match_type: "keyword" as const,
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

  const cancelEdit = () => {
    setEditingId(null);
    setNewRule(emptyRule);
    setEscalationLevels([]);
  };

  const handleEditClick = (rule: RoutingRule) => {
    setEditingId(rule.id);
    setNewRule({
      name: rule.name || "",
      match_type: (rule.match_type as "keyword" | "prefix" | "fallback" | "sender") || "keyword",
      match_value: rule.match_value || "",
      target_group_id: rule.target_group_id || "",
      gateway_id: rule.gateway_id || "",
      priority: rule.priority ?? 0,
    });
    setEscalationLevels(rule.escalation_config || []);
    document.getElementById("routing-rule-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

  const fetchData = async () => {
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
      toast({
        title: "Feil ved lasting",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveRule = async () => {
    try {
      if (!newRule.target_group_id || !newRule.gateway_id) {
        toast({
          title: "Mangler informasjon",
          description: "Velg både målgruppe og gateway",
          variant: "destructive",
        });
        return;
      }

      const escalationConfig = escalationLevels.length > 0 ? escalationLevels : null;

      if (editingId) {
        await routingRuleService.updateRule(editingId, {
          name: newRule.name,
          match_type: newRule.match_type,
          match_value: newRule.match_value,
          target_group_id: newRule.target_group_id,
          gateway_id: newRule.gateway_id,
          priority: newRule.priority,
          escalation_config: escalationConfig,
        });
        toast({ title: "Regel oppdatert", description: "Rutingsregelen er lagret" });
        setEditingId(null);
      } else {
        await routingRuleService.createRule({
          ...newRule,
          priority: rules.length,
          is_active: true,
          escalation_config: escalationConfig,
        });
        toast({ title: "Regel opprettet", description: "Den nye rutingsregelen er lagret" });
      }

      fetchData();
      setNewRule(emptyRule);
      setEscalationLevels([]);
    } catch (error) {
      console.error("Failed to save rule:", error);
      toast({
        title: "Feil",
        description: editingId ? "Kunne ikke oppdatere regel" : "Kunne ikke opprette regel",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await routingRuleService.deleteRule(id);
      toast({
        title: "Regel slettet",
        description: "Rutingsregelen er fjernet",
      });
      fetchData();
    } catch (error) {
      console.error("Failed to delete rule:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette regel",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await routingRuleService.updateRule(id, { is_active: isActive });
      fetchData();
    } catch (error) {
      console.error("Failed to toggle rule:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere regel",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const matchTypeBadgeClass = (type: string) => {
    switch (type) {
      case "keyword":  return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
      case "prefix":   return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300";
      case "sender":   return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300";
      case "fallback": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300";
      default:         return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Form ── */}
      <div id="routing-rule-form" className="grid gap-2 p-3 border rounded-lg bg-card">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {editingId ? "Rediger rutingsregel" : "Ny rutingsregel"}
        </p>

        {/* Row 1: name + type */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Navn på regel</Label>
            <Input
              placeholder="F.eks. Support Nøkkelord"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type regel</Label>
            <Select
              value={newRule.match_type}
              onValueChange={(value: any) =>
                setNewRule({ ...newRule, match_type: value })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Nøkkelord (Inneholder)</SelectItem>
                <SelectItem value="prefix">Prefiks (Starter med)</SelectItem>
                <SelectItem value="sender">Kjent avsender</SelectItem>
                <SelectItem value="fallback">Fallback (Standard)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2 (conditional): match value — half-width left col */}
        {newRule.match_type === "sender" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Avsender-ID</Label>
              <Input
                placeholder="'+4799887766' eller 'Kraftverk-AS'"
                value={newRule.match_value}
                maxLength={11}
                onChange={(e) => setNewRule({ ...newRule, match_value: e.target.value })}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground leading-tight">Tlf. (+47…) eller alfanumerisk (maks 11 tegn).</p>
            </div>
          </div>
        )}

        {(newRule.match_type === "keyword" || newRule.match_type === "prefix") && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{newRule.match_type === "keyword" ? "Nøkkelord" : "Prefiks"}</Label>
              <Input
                placeholder={newRule.match_type === "keyword" ? "f.eks. 'hjelp'" : "f.eks. 'START'"}
                value={newRule.match_value}
                onChange={(e) => setNewRule({ ...newRule, match_value: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}

        {/* Row 3: group + gateway */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Send til gruppe</Label>
            <Select
              value={newRule.target_group_id}
              onValueChange={(value) => setNewRule({ ...newRule, target_group_id: value })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Velg gruppe" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bruk gateway</Label>
            <Select
              value={newRule.gateway_id}
              onValueChange={(value) => setNewRule({ ...newRule, gateway_id: value })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Velg gateway" />
              </SelectTrigger>
              <SelectContent>
                {gateways.map((gateway) => (
                  <SelectItem key={gateway.id} value={gateway.id}>
                    {gateway.name} ({gateway.gw_phone || "Ingen telefon"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Escalation levels ── */}
        <Separator className="my-0.5" />
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Eskaleringsnivåer</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={escalationLevels.length >= 3}
              onClick={addEscalationLevel}
              className="h-6 text-xs px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              Legg til nivå
            </Button>
          </div>

          {escalationLevels.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Ingen eskaleringsnivåer lagt til ennå.</p>
          )}

          {escalationLevels.map((level, index) => (
            <div key={index} className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-muted/20 flex-wrap">
              {/* Badge */}
              <Badge variant="outline" className="font-mono text-xs h-5 px-1.5 shrink-0">
                Nivå {level.level}
              </Badge>

              {/* Timeout */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Etter</span>
                <Input
                  type="number"
                  min={1}
                  value={level.timeout_minutes}
                  onChange={(e) =>
                    updateEscalationLevel(index, { timeout_minutes: parseInt(e.target.value) || 1 })
                  }
                  className="h-6 w-14 text-xs px-1.5"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">min</span>
              </div>

              {/* Group */}
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

              {/* Methods */}
              <div className="flex items-center gap-2">
                {(["sms", "push", "voicecall"] as const).map((method) => (
                  <label key={method} className="flex items-center gap-1 cursor-pointer select-none text-xs whitespace-nowrap">
                    <Checkbox
                      checked={level.methods.includes(method)}
                      onCheckedChange={() => toggleMethod(index, method)}
                      className="h-3.5 w-3.5"
                    />
                    {method === "sms" ? "SMS" : method === "push" ? "App-varsel" : "Voicecall"}
                  </label>
                ))}
              </div>

              {/* Delete */}
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
          ))}
        </div>

        {/* Save / cancel */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSaveRule} size="sm" className="h-7 text-xs">
            {editingId
              ? "Oppdater regel"
              : <><Plus className="h-3.5 w-3.5 mr-1" />Legg til regel</>
            }
          </Button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Avbryt
            </button>
          )}
        </div>
      </div>

      {/* ── Active rules list ── */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aktive regler</p>
        {rules.length === 0 ? (
          <div className="text-center p-6 border rounded-lg border-dashed text-muted-foreground text-sm">
            Ingen rutingsregler definert ennå
          </div>
        ) : (
          <div className="space-y-1">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg border transition-colors ${
                  editingId === rule.id
                    ? "bg-primary/5 border-primary/40"
                    : "bg-secondary/20"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="bg-background p-1 rounded-full border shrink-0">
                    <ArrowDownUp className="h-3 w-3 text-muted-foreground" />
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
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleEditClick(rule)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}