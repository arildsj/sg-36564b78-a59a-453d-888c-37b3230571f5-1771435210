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
import { Loader2, Plus, Trash2, ArrowDownUp, MessageSquare, Globe, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RoutingRulesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [newRule, setNewRule] = useState<{
    name: string;
    match_type: "keyword" | "prefix" | "fallback";
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
    const loadData = async () => {
      try {
        const [groupsData, gatewaysData, rulesData] = await Promise.all([
          groupService.getOperationalGroups(),
          gatewayService.getAll(),
          routingRuleService.getRules()
        ]);

        setGroups(groupsData);
        setGateways(gatewaysData);
        setRules(rulesData);
      } catch (error) {
        console.error("Failed to load routing data:", error);
      }
    };

    loadData();
  }, []);

  const handleCreateRule = async () => {
    try {
      if (!newRule.target_group_id || !newRule.gateway_id) {
        toast({
          title: "Mangler informasjon",
          description: "Velg både målgruppe og gateway",
          variant: "destructive",
        });
        return;
      }

      await routingRuleService.createRule({
        ...newRule,
        priority: rules.length,
        is_active: true
      });

      toast({
        title: "Regel opprettet",
        description: "Den nye rutingsregelen er lagret",
      });

      fetchData();
      setNewRule({
        name: "",
        match_type: "keyword",
        match_value: "",
        target_group_id: "",
        gateway_id: "",
        priority: 0,
      });
    } catch (error) {
      console.error("Failed to create rule:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke opprette regel",
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
      <div className="grid gap-4 p-4 border rounded-lg bg-card">
        <h3 className="font-medium">Ny rutingsregel</h3>
        
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
                <SelectItem value="fallback">Fallback (Standard)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {newRule.match_type !== "fallback" && (
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

        <Button onClick={handleCreateRule} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Legg til regel
        </Button>
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
                className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg border"
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