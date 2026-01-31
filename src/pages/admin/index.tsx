import React, { useEffect, useState } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GroupHierarchy } from "@/components/GroupHierarchy";
import { groupService } from "@/services/groupService";
import { userService } from "@/services/userService";
import { gatewayService } from "@/services/gatewayService";
import { routingRuleService } from "@/services/routingRuleService";
import { contactService } from "@/services/contactService";
import { Users, FolderTree, Shield, Plus, Settings, Wifi, Star, GitBranch, Trash2, AlertTriangle, UserCog, Clock, Phone } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type GroupNode = {
  id: string;
  name: string;
  kind: "structural" | "operational";
  parent_id: string | null;
  description?: string | null;
  member_count?: number;
  on_duty_count?: number;
  children?: GroupNode[];
};

type User = Database["public"]["Tables"]["users"]["Row"] & {
  groups?: string[];
};

type Gateway = {
  id: string;
  name: string;
  base_url: string;
  api_key: string | null;
  status: string;
  is_default: boolean;
  tenant_id: string;
  created_at: string;
  phone_number: string;
};

type RoutingRule = {
  id: string;
  gateway_id: string;
  target_group_id: string;
  priority: number;
  rule_type: "prefix" | "keyword" | "fallback";
  pattern: string | null;
  is_active: boolean;
  gateway?: {
    id: string;
    name: string;
  };
  target_group?: {
    id: string;
    name: string;
  };
};

type Contact = {
  id: string;
  phone: string;
  name: string | null;
  groups: string[];
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("groups");
  const [groups, setGroups] = useState<GroupNode[]>([]);
  const [allGroups, setAllGroups] = useState<GroupNode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [realUser, setRealUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupNode | null>(null);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [groupContacts, setGroupContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newGroup, setNewGroup] = useState({
    name: "",
    kind: "operational" as "structural" | "operational",
    parent_id: null as string | null,
    description: "",
  });

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    role: "member",
    password: "",
    group_ids: [] as string[]
  });

  const [newGateway, setNewGateway] = useState({
    name: "",
    base_url: "",
    api_key: "",
    is_active: true,
    is_default: false,
    phone_number: "",
  });

  const [newRoutingRule, setNewRoutingRule] = useState({
    gateway_id: "",
    target_group_id: "",
    priority: 10,
    rule_type: "fallback" as "prefix" | "keyword" | "fallback",
    pattern: "",
    is_active: true,
  });

  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showCreateGatewayDialog, setShowCreateGatewayDialog] = useState(false);
  const [showCreateRoutingRuleDialog, setShowCreateRoutingRuleDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsData, usersData, currentUserData, realUserData, gatewaysData, routingRulesData] = await Promise.all([
        groupService.getGroupsHierarchy(),
        userService.getAllUsers(),
        userService.getCurrentUserWithDemo(),
        userService.getCurrentUser(),
        gatewayService.getAllGateways(),
        routingRuleService.getRoutingRules(),
      ]);
      setGroups(groupsData as GroupNode[]);
      
      const flattenGroups = (groups: GroupNode[]): GroupNode[] => {
        const flat: GroupNode[] = [];
        const traverse = (g: GroupNode[]) => {
          g.forEach(group => {
            flat.push(group);
            if (group.children) traverse(group.children);
          });
        };
        traverse(groups);
        return flat;
      };
      setAllGroups(flattenGroups(groupsData as GroupNode[]));
      
      setUsers(usersData as User[]);
      setCurrentUser(currentUserData as unknown as User);
      setRealUser(realUserData as unknown as User);
      setIsDemoMode(currentUserData?.id !== realUserData?.id);
      setGateways(gatewaysData as Gateway[]);
      setRoutingRules(routingRulesData as RoutingRule[]);
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchUser = (userId: string) => {
    const selectedUser = users.find(u => u.id === userId);
    if (selectedUser) {
      userService.setImpersonatedUser(selectedUser);
      setCurrentUser(selectedUser);
      setIsDemoMode(true);
      window.location.reload();
    }
  };

  const handleExitDemoMode = () => {
    userService.setImpersonatedUser(null);
    setIsDemoMode(false);
    setCurrentUser(realUser);
    window.location.reload();
  };

  const handleSelectGroup = async (group: GroupNode) => {
    setSelectedGroup(group);
    setShowGroupDetails(true);
    
    try {
      const [members, contacts] = await Promise.all([
        userService.getUsersByGroup(group.id),
        contactService.getContactsByGroup(group.id),
      ]);
      setGroupMembers(members as User[]);
      setGroupContacts(contacts);
    } catch (error) {
      console.error("Failed to load group details:", error);
    }
  };

  const handleCreateGroup = async () => {
    try {
      setCreating(true);

      if (!newGroup.name.trim()) {
        alert("Vennligst fyll ut gruppenavn");
        return;
      }

      if (!currentUser?.tenant_id) {
        alert("Kan ikke opprette gruppe: Mangler tenant ID");
        return;
      }

      await groupService.createGroup({
        name: newGroup.name,
        kind: newGroup.kind,
        parent_id: newGroup.parent_id,
        description: newGroup.description || null,
        tenant_id: currentUser.tenant_id,
      });

      setNewGroup({
        name: "",
        kind: "operational",
        parent_id: null,
        description: "",
      });
      setShowCreateDialog(false);
      await loadData();
    } catch (error: any) {
      console.error("Failed to create group:", error);
      alert(`Feil ved opprettelse av gruppe: ${error.message || "Ukjent feil"}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setCreating(true);

      if (!newUser.name || !newUser.email || !newUser.password) {
        alert("Vennligst fyll ut navn, e-post og passord");
        return;
      }

      await userService.createUser({
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role as any,
        password: newUser.password,
        group_ids: newUser.group_ids
      });

      setNewUser({
        name: "",
        email: "",
        phone: "",
        role: "member",
        password: "",
        group_ids: []
      });
      setShowCreateUserDialog(false);
      await loadData();
    } catch (error: any) {
      console.error("Failed to create user:", error);
      alert(`Feil ved opprettelse: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateGateway = async () => {
    try {
      setCreating(true);

      if (!newGateway.name.trim() || !newGateway.base_url.trim()) {
        alert("Vennligst fyll ut navn og URL");
        return;
      }

      if (!currentUser?.tenant_id) {
        alert("Kan ikke opprette gateway: Mangler tenant ID");
        return;
      }

      await gatewayService.createGateway({
        name: newGateway.name,
        base_url: newGateway.base_url,
        api_key: newGateway.api_key || null,
        status: newGateway.is_active ? 'active' : 'inactive',
        is_default: newGateway.is_default,
        phone_number: newGateway.phone_number,
        tenant_id: currentUser.tenant_id,
      });

      setNewGateway({
        name: "",
        base_url: "",
        api_key: "",
        is_active: true,
        is_default: false,
        phone_number: "",
      });
      setShowCreateGatewayDialog(false);
      await loadData();
    } catch (error: any) {
      console.error("Failed to create gateway:", error);
      alert(`Feil ved opprettelse av gateway: ${error.message || "Ukjent feil"}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateRoutingRule = async () => {
    try {
      setCreating(true);

      if (!newRoutingRule.gateway_id || !newRoutingRule.target_group_id) {
        alert("Vennligst velg gateway og målgruppe");
        return;
      }

      await routingRuleService.createRoutingRule({
        gateway_id: newRoutingRule.gateway_id,
        target_group_id: newRoutingRule.target_group_id,
        priority: newRoutingRule.priority,
        rule_type: newRoutingRule.rule_type,
        pattern: newRoutingRule.pattern || undefined,
        is_active: newRoutingRule.is_active,
      });

      setNewRoutingRule({
        gateway_id: "",
        target_group_id: "",
        priority: 10,
        rule_type: "fallback",
        pattern: "",
        is_active: true,
      });
      setShowCreateRoutingRuleDialog(false);
      await loadData();
    } catch (error: any) {
      console.error("Failed to create routing rule:", error);
      alert(`Feil ved opprettelse av routing rule: ${error.message || "Ukjent feil"}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoutingRule = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne routing rule?")) return;
    
    try {
      await routingRuleService.deleteRoutingRule(id);
      await loadData();
    } catch (error: any) {
      console.error("Failed to delete routing rule:", error);
      alert(`Feil ved sletting: ${error.message}`);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne gruppen? Dette kan ikke angres.")) return;
    
    try {
      await groupService.deleteGroup(groupId);
      await loadData();
    } catch (error: any) {
      console.error("Failed to delete group:", error);
      alert(`Feil ved sletting: ${error.message}`);
    }
  };

  const handleToggleRoutingRule = async (id: string, isActive: boolean) => {
    try {
      await routingRuleService.toggleRoutingRule(id, isActive);
      await loadData();
    } catch (error: any) {
      console.error("Failed to toggle routing rule:", error);
      alert(`Feil ved oppdatering: ${error.message}`);
    }
  };

  const handleSetDefaultGateway = async (gatewayId: string) => {
    if (!currentUser?.tenant_id) return;
    
    try {
      await gatewayService.setDefaultGateway(gatewayId, currentUser.tenant_id);
      await loadData();
    } catch (error: any) {
      console.error("Failed to set default gateway:", error);
      alert(`Feil ved oppdatering: ${error.message}`);
    }
  };

  const handleDeleteGateway = async (gatewayId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne gatewayen?")) return;
    
    try {
      await gatewayService.deleteGateway(gatewayId);
      await loadData();
    } catch (error: any) {
      console.error("Failed to delete gateway:", error);
      alert(`Feil ved sletting: ${error.message}`);
    }
  };

  const toggleUserGroupSelection = (groupId: string) => {
    setNewUser((prev) => ({
      ...prev,
      group_ids: prev.group_ids.includes(groupId)
        ? prev.group_ids.filter((id) => id !== groupId)
        : [...prev.group_ids, groupId],
    }));
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "tenant_admin": return "default";
      case "group_admin": return "secondary";
      default: return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "tenant_admin": return "Tenant-admin";
      case "group_admin": return "Gruppe-admin";
      default: return "Medlem";
    }
  };

  return (
    <>
      <Head>
        <title>Admin | SeMSe</title>
        <meta name="description" content="Administrer brukere, grupper og tilganger" />
      </Head>

      <AppLayout>
        <div className="space-y-6">
          {isDemoMode && (
            <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900 dark:text-amber-100">Demo-modus aktivert</AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Du viser systemet som <strong>{currentUser?.name}</strong> ({getRoleLabel(currentUser?.role || "")}).
                Dette er kun for presentasjons- og demo-formål.
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-4 border-amber-600 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/30"
                  onClick={handleExitDemoMode}
                >
                  Gå tilbake til {realUser?.name}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Administrasjon</h2>
              <p className="text-muted-foreground mt-2">
                Administrer brukere, grupper, gateways og systeminnstillinger.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Card className="p-3">
                <div className="flex items-center gap-3">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Aktiv bruker (Demo)</Label>
                    <Select value={currentUser?.id} onValueChange={handleSwitchUser}>
                      <SelectTrigger className="w-[280px] h-9">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{currentUser?.name}</span>
                            <Badge variant={getRoleBadgeVariant(currentUser?.role || "")} className="text-xs">
                              {getRoleLabel(currentUser?.role || "")}
                            </Badge>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center gap-2">
                              <span>{user.name}</span>
                              <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                                {getRoleLabel(user.role)}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4" />
                Opprett ny gruppe
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 lg:w-auto">
              <TabsTrigger value="groups" className="gap-2">
                <FolderTree className="h-4 w-4" />
                Grupper
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Brukere
              </TabsTrigger>
              <TabsTrigger value="gateways" className="gap-2">
                <Wifi className="h-4 w-4" />
                Gateways
              </TabsTrigger>
              <TabsTrigger value="routing" className="gap-2">
                <GitBranch className="h-4 w-4" />
                Routing
              </TabsTrigger>
              <TabsTrigger value="roles" className="gap-2">
                <Shield className="h-4 w-4" />
                Roller
              </TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gruppehierarki</CardTitle>
                  <CardDescription>
                    Hierarkisk visning av alle strukturelle og operasjonelle grupper. Klikk på en gruppe for å se detaljer, medlemmer og kontakter.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Laster grupper...</div>
                  ) : groups.length === 0 ? (
                    <div className="text-center py-8">
                      <FolderTree className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Ingen grupper opprettet ennå</p>
                      <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Opprett første gruppe
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <Button onClick={() => setShowCreateDialog(true)} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Opprett ny gruppe
                        </Button>
                      </div>
                      <GroupHierarchy 
                        groups={groups} 
                        onSelectGroup={handleSelectGroup}
                        selectedGroupId={selectedGroup?.id}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Brukeradministrasjon</CardTitle>
                  <CardDescription>
                    Administrer brukere, roller og gruppetilhørighet.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Laster brukere...</div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Ingen brukere opprettet ennå</p>
                      <Button variant="outline" onClick={() => setShowCreateUserDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Opprett første bruker
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-4">
                        <Button onClick={() => setShowCreateUserDialog(true)} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Ny bruker
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Navn</TableHead>
                            <TableHead>E-post</TableHead>
                            <TableHead>Telefon</TableHead>
                            <TableHead>Grupper</TableHead>
                            <TableHead>Rolle</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Handlinger</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((user) => (
                            <TableRow key={user.id} className="hover:bg-accent">
                              <TableCell className="font-medium">{user.name}</TableCell>
                              <TableCell>{user.email || "—"}</TableCell>
                              <TableCell>{(user as any).phone_number || "—"}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {user.groups && user.groups.length > 0 ? (
                                    user.groups.map((groupName, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        {groupName}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getRoleBadgeVariant(user.role)}>
                                  {getRoleLabel(user.role)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={user.status === "active" ? "default" : "destructive"}>
                                  {user.status === "active" ? "Aktiv" : "Inaktiv"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  Rediger
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gateways" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>FairGateway-administrasjon</CardTitle>
                  <CardDescription>
                    Konfigurer og administrer SMS-gateways for sending og mottak av meldinger.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Laster gateways...</div>
                  ) : gateways.length === 0 ? (
                    <div className="text-center py-8">
                      <Wifi className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Ingen gateways konfigurert ennå</p>
                      <Button variant="outline" onClick={() => setShowCreateGatewayDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Legg til første gateway
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-4">
                        <Button onClick={() => setShowCreateGatewayDialog(true)} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Legg til gateway
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Navn</TableHead>
                            <TableHead>Base URL</TableHead>
                            <TableHead>Telefonnummer</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Standard</TableHead>
                            <TableHead className="text-right">Handlinger</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gateways.map((gateway) => (
                            <TableRow key={gateway.id} className="hover:bg-accent">
                              <TableCell className="font-medium">{gateway.name}</TableCell>
                              <TableCell className="font-mono text-sm">{gateway.base_url}</TableCell>
                              <TableCell>{gateway.phone_number}</TableCell>
                              <TableCell>
                                <Badge variant={gateway.status === 'active' ? "default" : "secondary"}>
                                  {gateway.status === 'active' ? "Aktiv" : "Inaktiv"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {gateway.is_default ? (
                                  <Badge variant="default" className="gap-1">
                                    <Star className="h-3 w-3 fill-current" />
                                    Standard
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSetDefaultGateway(gateway.id)}
                                  >
                                    Sett som standard
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button variant="ghost" size="sm">
                                    Rediger
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteGateway(gateway.id)}
                                  >
                                    Slett
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="routing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gateway-til-gruppe routing</CardTitle>
                  <CardDescription>
                    Konfigurer hvilke grupper som er tilknyttet hver gateway. Når meldinger kommer inn til en gateway, rutes de automatisk til riktig gruppe basert på disse reglene.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Laster routing rules...</div>
                  ) : routingRules.length === 0 ? (
                    <div className="text-center py-8">
                      <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Ingen routing rules konfigurert ennå</p>
                      <Button variant="outline" onClick={() => setShowCreateRoutingRuleDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Opprett første routing rule
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-4">
                        <Button onClick={() => setShowCreateRoutingRuleDialog(true)} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Ny routing rule
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Gateway</TableHead>
                            <TableHead>Målgruppe</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Mønster</TableHead>
                            <TableHead>Prioritet</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Handlinger</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {routingRules.map((rule) => (
                            <TableRow key={rule.id} className="hover:bg-accent">
                              <TableCell className="font-medium">
                                {rule.gateway?.name || "—"}
                              </TableCell>
                              <TableCell>
                                {rule.target_group?.name || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {rule.rule_type === "prefix" ? "Prefiks" : 
                                   rule.rule_type === "keyword" ? "Nøkkelord" : "Fallback"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {rule.pattern || "—"}
                              </TableCell>
                              <TableCell>{rule.priority}</TableCell>
                              <TableCell>
                                <Switch
                                  checked={rule.is_active}
                                  onCheckedChange={(checked) => handleToggleRoutingRule(rule.id, checked)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteRoutingRule(rule.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Rollestyring</CardTitle>
                  <CardDescription>
                    Oversikt over roller og tilgangsnivåer i systemet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">Tenant-administrator</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Full tilgang til alle funksjoner innenfor leieren (organisasjonen).
                        </p>
                        <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                          <li>Administrere alle grupper og brukere</li>
                          <li>Konfigurere gateways og routing-regler</li>
                          <li>Tilgang til alle meldinger i leieren</li>
                          <li>Se audit-logger</li>
                        </ul>
                      </div>
                      <Badge variant="default">{users.filter(u => u.role === "tenant_admin").length} brukere</Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">Gruppe-administrator</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Administrere tildelte grupper og undergrupper.
                        </p>
                        <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                          <li>Administrere gruppetilhørighet</li>
                          <li>Konfigurere åpningstider og auto-svar</li>
                          <li>Tilgang til meldinger i tildelte grupper</li>
                        </ul>
                      </div>
                      <Badge variant="secondary">{users.filter(u => u.role === "group_admin").length} brukere</Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">Medlem</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Operativ bruker med tilgang til gruppens innboks.
                        </p>
                        <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                          <li>Lese og svare på meldinger i grupper</li>
                          <li>Administrere egen vakt-status</li>
                          <li>Se kontakter knyttet til gruppene</li>
                        </ul>
                      </div>
                      <Badge variant="outline">{users.filter(u => u.role === "member").length} brukere</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opprett ny gruppe</DialogTitle>
            <DialogDescription>
              Opprett en strukturell eller operasjonell gruppe. Operasjonelle grupper fungerer som innbokser for meldinger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Gruppenavn *</Label>
              <Input
                id="group-name"
                placeholder="F.eks. Support, Salg, IT-avdelingen"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-kind">Type *</Label>
              <select
                id="group-kind"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newGroup.kind}
                onChange={(e) => setNewGroup({ ...newGroup, kind: e.target.value as "structural" | "operational" })}
              >
                <option value="operational">Operasjonell (innboks for meldinger)</option>
                <option value="structural">Strukturell (organisering)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {newGroup.kind === "operational" 
                  ? "Operasjonelle grupper mottar og håndterer meldinger" 
                  : "Strukturelle grupper brukes kun for organisering"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-parent">Foreldregruppe (valgfri)</Label>
              <select
                id="group-parent"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newGroup.parent_id || ""}
                onChange={(e) => setNewGroup({ ...newGroup, parent_id: e.target.value || null })}
              >
                <option value="">Ingen (topp-nivå)</option>
                {allGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.kind === "operational" ? "Operasjonell" : "Strukturell"})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Velg en foreldregruppe for å skape et hierarki
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">Beskrivelse (valgfri)</Label>
              <Textarea
                id="group-description"
                placeholder="Kort beskrivelse av gruppens formål..."
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleCreateGroup} disabled={creating}>
              {creating ? "Oppretter..." : "Opprett gruppe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Opprett ny bruker</DialogTitle>
            <DialogDescription>
              Legg til en ny bruker i systemet og tildel grupper.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Navn *</Label>
                <Input
                  id="user-name"
                  placeholder="Fullt navn"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">E-post *</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-phone">Telefon (valgfri)</Label>
                <Input
                  id="user-phone"
                  placeholder="+47..."
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Rolle *</Label>
                <select
                  id="user-role"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="member">Medlem</option>
                  <option value="group_admin">Gruppe-admin</option>
                  <option value="tenant_admin">Tenant-admin</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password">Passord *</Label>
              <Input
                id="user-password"
                type="password"
                placeholder="Minst 6 tegn"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Gruppetilhørighet</Label>
              <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                {allGroups.filter(g => g.kind === 'operational').length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen operasjonelle grupper tilgjengelig</p>
                ) : (
                  allGroups
                    .filter(g => g.kind === 'operational')
                    .map((group) => (
                      <label key={group.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent p-1 rounded">
                        <input
                          type="checkbox"
                          checked={newUser.group_ids.includes(group.id)}
                          onChange={() => toggleUserGroupSelection(group.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">{group.name}</span>
                      </label>
                    ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserDialog(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? "Oppretter..." : "Opprett bruker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateGatewayDialog} onOpenChange={setShowCreateGatewayDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Legg til ny gateway</DialogTitle>
            <DialogDescription>
              Konfigurer en FairGateway for sending og mottak av SMS-meldinger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gateway-name">Navn *</Label>
              <Input
                id="gateway-name"
                placeholder="F.eks. FairGateway Produksjon"
                value={newGateway.name}
                onChange={(e) => setNewGateway({ ...newGateway, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gateway-phone">Telefonnummer *</Label>
              <Input
                id="gateway-phone"
                placeholder="+47..."
                value={newGateway.phone_number}
                onChange={(e) => setNewGateway({ ...newGateway, phone_number: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Telefonnummeret tilknyttet denne gatewayen
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gateway-url">Base URL *</Label>
              <Input
                id="gateway-url"
                placeholder="https://gateway.example.com"
                value={newGateway.base_url}
                onChange={(e) => setNewGateway({ ...newGateway, base_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                URL til FairGateway API (f.eks. https://gateway.fair.no eller http://localhost:8080)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gateway-api-key">API-nøkkel (valgfri)</Label>
              <Input
                id="gateway-api-key"
                type="password"
                placeholder="API-nøkkel for autentisering"
                value={newGateway.api_key}
                onChange={(e) => setNewGateway({ ...newGateway, api_key: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                API-nøkkel brukes for sikker autentisering mot gateway-tjenesten
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="gateway-active">Aktiver gateway</Label>
                  <p className="text-xs text-muted-foreground">
                    Kun aktive gateways brukes for sending av meldinger
                  </p>
                </div>
                <Switch
                  id="gateway-active"
                  checked={newGateway.is_active}
                  onCheckedChange={(checked) => setNewGateway({ ...newGateway, is_active: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="gateway-default">Sett som standard gateway</Label>
                  <p className="text-xs text-muted-foreground">
                    Standard gateway brukes når ingen spesifikk gateway er valgt
                  </p>
                </div>
                <Switch
                  id="gateway-default"
                  checked={newGateway.is_default}
                  onCheckedChange={(checked) => setNewGateway({ ...newGateway, is_default: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGatewayDialog(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleCreateGateway} disabled={creating}>
              {creating ? "Legger til..." : "Legg til gateway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateRoutingRuleDialog} onOpenChange={setShowCreateRoutingRuleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Opprett routing rule</DialogTitle>
            <DialogDescription>
              Koble en gateway til en målgruppe. Innkommende meldinger til denne gatewayen vil automatisk rutes til den valgte gruppen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-gateway">Gateway *</Label>
              <Select value={newRoutingRule.gateway_id} onValueChange={(value) => setNewRoutingRule({ ...newRoutingRule, gateway_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg gateway" />
                </SelectTrigger>
                <SelectContent>
                  {gateways.map((gw) => (
                    <SelectItem key={gw.id} value={gw.id}>
                      {gw.name} ({gw.phone_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-group">Målgruppe *</Label>
              <Select value={newRoutingRule.target_group_id} onValueChange={(value) => setNewRoutingRule({ ...newRoutingRule, target_group_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg målgruppe" />
                </SelectTrigger>
                <SelectContent>
                  {allGroups.filter(g => g.kind === 'operational').map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Meldinger som kommer til gatewayen vil bli rutet til denne gruppen
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-type">Regeltype *</Label>
              <Select value={newRoutingRule.rule_type} onValueChange={(value: any) => setNewRoutingRule({ ...newRoutingRule, rule_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fallback">Fallback (standard routing)</SelectItem>
                  <SelectItem value="prefix">Prefiks (basert på meldingsinnhold)</SelectItem>
                  <SelectItem value="keyword">Nøkkelord (basert på meldingsinnhold)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(newRoutingRule.rule_type === "prefix" || newRoutingRule.rule_type === "keyword") && (
              <div className="space-y-2">
                <Label htmlFor="rule-pattern">Mønster *</Label>
                <Input
                  id="rule-pattern"
                  placeholder={newRoutingRule.rule_type === "prefix" ? "F.eks. SUPPORT" : "F.eks. hjelp"}
                  value={newRoutingRule.pattern}
                  onChange={(e) => setNewRoutingRule({ ...newRoutingRule, pattern: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {newRoutingRule.rule_type === "prefix" 
                    ? "Meldinger som starter med dette prefikset rutes til gruppen" 
                    : "Meldinger som inneholder dette nøkkelordet rutes til gruppen"}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rule-priority">Prioritet</Label>
              <Input
                id="rule-priority"
                type="number"
                min="0"
                max="100"
                value={newRoutingRule.priority}
                onChange={(e) => setNewRoutingRule({ ...newRoutingRule, priority: parseInt(e.target.value) || 10 })}
              />
              <p className="text-xs text-muted-foreground">
                Høyere tall = høyere prioritet (0-100). Fallback-regler bør ha lavest prioritet.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="rule-active">Aktiver regel</Label>
                <p className="text-xs text-muted-foreground">
                  Kun aktive regler brukes for routing
                </p>
              </div>
              <Switch
                id="rule-active"
                checked={newRoutingRule.is_active}
                onCheckedChange={(checked) => setNewRoutingRule({ ...newRoutingRule, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRoutingRuleDialog(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleCreateRoutingRule} disabled={creating}>
              {creating ? "Oppretter..." : "Opprett regel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showGroupDetails} onOpenChange={setShowGroupDetails}>
        <SheetContent className="w-[600px] sm:w-[700px] overflow-y-auto">
          {selectedGroup && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedGroup.name}
                  <Badge variant={selectedGroup.kind === "operational" ? "default" : "secondary"}>
                    {selectedGroup.kind === "operational" ? "Operasjonell" : "Strukturell"}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {selectedGroup.description || "Ingen beskrivelse tilgjengelig"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Medlemmer ({groupMembers.length})</h3>
                  </div>
                  {groupMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen medlemmer i denne gruppen</p>
                  ) : (
                    <div className="space-y-2">
                      {groupMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                          <Badge variant={getRoleBadgeVariant(member.role)}>
                            {getRoleLabel(member.role)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Hvitelistede kontakter ({groupContacts.length})</h3>
                  </div>
                  {groupContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen kontakter tilknyttet denne gruppen</p>
                  ) : (
                    <div className="space-y-2">
                      {groupContacts.map((contact) => (
                        <div key={contact.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div>
                            <p className="font-medium">{contact.name || "Uten navn"}</p>
                            <p className="text-sm text-muted-foreground font-mono">{contact.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedGroup.kind === "operational" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">Åpningstider</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Konfigurasjon av åpningstider kommer snart
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1">
                    Rediger gruppe
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      setShowGroupDetails(false);
                      handleDeleteGroup(selectedGroup.id);
                    }}
                  >
                    Slett gruppe
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}