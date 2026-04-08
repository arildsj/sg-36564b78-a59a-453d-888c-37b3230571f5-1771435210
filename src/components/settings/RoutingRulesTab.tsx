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
import { routingRuleService, type RoutingRule } from "@/services/routingRuleService";
import { groupService } from "@/services/groupService";
import { gatewayService, type Gateway } from "@/services/gatewayService";
import { Loader2, Plus, Trash2, ArrowDownUp, MessageSquare, Globe, GripVertical, Pencil } from "lucide-react";
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

  const emptyRule = {
    name: "",
    match_type: "keyword" as const,
    match_value: "",
    target_group_id: "",
    gateway_id: "",
    priority: 0,
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewRule(emptyRule);
  };

  const handleEditClick = (rule: RoutingRule) => {
    setEditingId(rule.id);
    setNewRule({
      name: rule.name || "",
      match_type: rule.match_type as "keyword" | "prefix" | "fallback",
      match_value: rule.match_value || "",
      target_group_id: rule.target_group_id || "",
      gateway_id: rule.gateway_id || "",
      priority: rule.priority ?? 0,
    });
    // Scroll form into view
    document.getElementById("routing-rule-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

      if (editingId) {
        await routingRuleService.updateRule(editingId, {
          name: newRule.name,
          match_type: newRule.match_type,
          match_value: newRule.match_value,
          target_group_id: newRule.target_group_id,
          gateway_id: newRule.gateway_id,
          priority: newRule.priority,
        });
        toast({ title: "Regel oppdatert", description: "Rutingsregelen er lagret" });
        setEditingId(null);
      } else {
        await routingRuleService.createRule({
          ...newRule,
          priority: rules.length,
          is_active: true,
        });
        toast({ title: "Regel opprettet", description: "Den nye rutingsregelen er lagret" });
      }

      fetchData();
      setNewRule(emptyRule);
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

  return (
    <div className="space-y-6">
      <div id="routing-rule-form" className="grid gap-4 p-4 border rounded-lg bg-card">
        <h3 className="font-medium">{editingId ? "Rediger rutingsregel" : "Ny rutingsregel"}</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Navn på regel</Label>
            <Input
              placeholder="F.eks. Support Nøkkelord"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Type regel</Label>
            <Select
              value={newRule.match_type}
              onValueChange={(value: any) =>
                setNewRule({ ...newRule, match_type: value })
              }
            >
              <SelectTrigger>
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

        {newRule.match_type === "sender" && (
          <div className="space-y-2">
            <Label>Avsender-ID</Label>
            <Input
              placeholder="f.eks. '+4799887766' eller 'Kraftverk-AS'"
              value={newRule.match_value}
              maxLength={11}
              onChange={(e) => setNewRule({ ...newRule, match_value: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Internasjonalt telefonnummer (+47…) eller alfanumerisk avsender-ID (maks 11 tegn, GSM-standard).
            </p>
          </div>
        )}

        {(newRule.match_type === "keyword" || newRule.match_type === "prefix") && (
          <div className="space-y-2">
            <Label>
              {newRule.match_type === "keyword" ? "Nøkkelord" : "Prefiks"}
            </Label>
            <Input
              placeholder={
                newRule.match_type === "keyword" ? "f.eks. 'hjelp'" : "f.eks. 'START'"
              }
              value={newRule.match_value}
              onChange={(e) => setNewRule({ ...newRule, match_value: e.target.value })}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Send til gruppe</Label>
            <Select
              value={newRule.target_group_id}
              onValueChange={(value) =>
                setNewRule({ ...newRule, target_group_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Velg gruppe" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Bruk gateway</Label>
            <Select
              value={newRule.gateway_id}
              onValueChange={(value) =>
                setNewRule({ ...newRule, gateway_id: value })
              }
            >
              <SelectTrigger>
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

        <div className="flex items-center gap-3">
          <Button onClick={handleSaveRule} className="w-full sm:w-auto">
            {editingId ? (
              "Oppdater regel"
            ) : (
              <><Plus className="h-4 w-4 mr-2" />Legg til regel</>
            )}
          </Button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Avbryt
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Aktive regler</h3>
        {rules.length === 0 ? (
          <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
            Ingen rutingsregler definert ennå
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  editingId === rule.id
                    ? "bg-primary/5 border-primary/40"
                    : "bg-secondary/20"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-background p-2 rounded-full border">
                    <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {rule.name || "Navnløs regel"}
                      <Badge variant="outline">{rule.match_type}</Badge>
                      {rule.match_value && (
                        <Badge variant="secondary" className="font-mono">
                          {rule.match_value}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Til: {rule.group_name || "Ukjent gruppe"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Via: {rule.gateway_name || "Ukjent gateway"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditClick(rule)}
                    title="Rediger regel"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) =>
                      handleToggleActive(rule.id, checked)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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