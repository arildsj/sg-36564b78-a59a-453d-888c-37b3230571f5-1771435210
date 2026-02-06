import React, { useEffect, useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, ArrowRight, Network, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { routingRuleService, type RoutingRule } from "@/services/routingRuleService";
import { gatewayService } from "@/services/gatewayService";
import { groupService } from "@/services/groupService";

export function RoutingRulesTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    gateway_id: string;
    target_group_id: string;
    rule_type: "prefix" | "keyword" | "fallback";
    pattern: string;
    priority: number;
  }>({
    gateway_id: "",
    target_group_id: "",
    rule_type: "keyword",
    pattern: "",
    priority: 10,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rulesData, gatewaysData, groupsData] = await Promise.all([
        routingRuleService.getRoutingRules(),
        gatewayService.getAllGateways(),
        groupService.getOperationalGroups(),
      ]);
      setRules(rulesData);
      setGateways(gatewaysData);
      setGroups(groupsData);
    } catch (error) {
      console.error("Failed to load routing data:", error);
      toast({
        title: "Feil ved lasting",
        description: "Kunne ikke laste routing-regler.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (rule: RoutingRule) => {
    setEditingRule(rule);
    setFormData({
      gateway_id: rule.gateway_id,
      target_group_id: rule.target_group_id,
      rule_type: rule.rule_type,
      pattern: rule.pattern,
      priority: rule.priority,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setFormData({
      gateway_id: "",
      target_group_id: "",
      rule_type: "keyword",
      pattern: "",
      priority: 10,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.gateway_id || !formData.target_group_id || !formData.pattern) {
      toast({
        title: "Mangler informasjon",
        description: "Vennligst fyll ut alle feltene.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRule) {
        // Update existing rule
        await routingRuleService.updateRoutingRule(editingRule.id, formData);
        toast({
          title: "Regel oppdatert",
          description: "Routing-regelen er oppdatert.",
        });
      } else {
        // Create new rule
        await routingRuleService.createRoutingRule(formData);
        toast({
          title: "Regel opprettet",
          description: "Routing-regelen er lagret.",
        });
      }
      handleCloseDialog();
      loadData();
    } catch (error) {
      console.error("Failed to save rule:", error);
      toast({
        title: "Feil",
        description: editingRule ? "Kunne ikke oppdatere regelen." : "Kunne ikke opprette regelen.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne regelen?")) return;

    try {
      await routingRuleService.deleteRoutingRule(id);
      toast({
        title: "Regel slettet",
        description: "Routing-regelen er fjernet.",
      });
      loadData();
    } catch (error) {
      console.error("Failed to delete rule:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette regelen.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      await routingRuleService.toggleRoutingRule(id, !currentState);
      // Optimistic update
      setRules(rules.map(r => r.id === id ? { ...r, is_active: !currentState } : r));
    } catch (error) {
      console.error("Failed to toggle rule:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere status.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Routing Regler</CardTitle>
          <CardDescription>
            Bestem hvilken gruppe som skal motta meldinger basert på innhold.
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Ny Regel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRule ? "Rediger routing-regel" : "Opprett ny routing-regel"}
              </DialogTitle>
              <DialogDescription>
                Meldinger som matcher regelen vil bli sendt til valgt gruppe.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Gateway</Label>
                <Select 
                  value={formData.gateway_id} 
                  onValueChange={(val) => setFormData({...formData, gateway_id: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Velg gateway" />
                  </SelectTrigger>
                  <SelectContent>
                    {gateways.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Regeltype</Label>
                  <Select 
                    value={formData.rule_type} 
                    onValueChange={(val: any) => setFormData({...formData, rule_type: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Nøkkelord</SelectItem>
                      <SelectItem value="prefix">Prefix (Starter med)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prioritet (høyere vinner)</Label>
                  <Input 
                    type="number" 
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mønster / Tekst</Label>
                <Input 
                  placeholder={formData.rule_type === "prefix" ? "Eks: SUPPORT" : "Eks: bestilling"}
                  value={formData.pattern}
                  onChange={(e) => setFormData({...formData, pattern: e.target.value})}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.rule_type === "prefix" 
                    ? "Meldingen må starte nøyaktig med denne teksten."
                    : "Meldingen må inneholde dette ordet."}
                </p>
              </div>

              <div className="flex justify-center py-2">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <Label>Målgruppe</Label>
                <Select 
                  value={formData.target_group_id} 
                  onValueChange={(val) => setFormData({...formData, target_group_id: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Velg gruppe" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Lagrer..." : editingRule ? "Oppdater regel" : "Lagre regel"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Laster regler...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Ingen routing-regler funnet.</p>
            <p className="text-sm">Opprett en regel for å automatisere meldingsfordeling.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioritet</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Regel</TableHead>
                <TableHead>Mønster</TableHead>
                <TableHead>Til Gruppe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.priority}</TableCell>
                  <TableCell>{rule.gateway?.name || "Ukjent"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {rule.rule_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{rule.pattern}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {rule.target_group?.name || "Ukjent"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={rule.is_active} 
                      onCheckedChange={(checked) => handleToggleActive(rule.id, rule.is_active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEdit(rule)}
                        className="hover:bg-primary/10"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(rule.id)}
                        className="text-destructive hover:text-destructive/90"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}