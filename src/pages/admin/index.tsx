import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Trash2, Shield, Settings, Server, Users, Activity, Router } from "lucide-react";
import { GroupHierarchy } from "@/components/GroupHierarchy";
import { RoutingRulesTab } from "@/components/settings/RoutingRulesTab";
import { supabase } from "@/integrations/supabase/client";
import { routingRuleService, type RoutingRule } from "@/services/routingRuleService";
import { gatewayService, type Gateway } from "@/services/gatewayService";
import { groupService, type Group } from "@/services/groupService";
import { userService, type UserProfile } from "@/services/userService";
import { auditService, type AuditLogEntry } from "@/services/auditService";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    phone_number: "",
    role: "member",
    group_ids: [] as string[],
    password: "", // Only for new users
  });

  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    kind: "operational",
    parent_id: "none",
    escalation_enabled: false,
    escalation_timeout_minutes: 30,
    min_on_duty_count: 1,
  });

  const [newGateway, setNewGateway] = useState({
    name: "",
    phone_number: "",
    api_key: "",
    base_url: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch Users
      const { data: usersData, error: usersError } = await db
        .from("user_profiles")
        .select(`
          *,
          group_memberships!group_memberships_user_id_fkey (
            group_id,
            groups (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch Groups
      const { data: groupsData, error: groupsError } = await db
        .from("group_admin_view")
        .select("*")
        .order("name", { ascending: true });

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // Fetch Gateways
      const { data: gatewaysData, error: gatewaysError } = await db
        .from("sms_gateways")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (gatewaysError) throw gatewaysError;
      setGateways(gatewaysData || []);

      // Fetch Audit Logs
      const logs = await auditService.getAuditLogs(20);
      setAuditLogs(logs);

    } catch (error: any) {
      console.error("Error fetching admin data:", error);
      toast({
        title: "Feil ved lasting av data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        // Verify user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast({
            title: "Ikke autentisert",
            description: "Du må logge inn for å se admin-panelet",
            variant: "destructive",
          });
          return;
        }

        // Fetch all data
        await fetchData();
      } catch (error: any) {
        console.error("Auth check failed:", error);
        toast({
          title: "Autentiseringsfeil",
          description: error.message,
          variant: "destructive",
        });
      }
    };

    checkAuthAndFetch();
  }, []);

  const handleCreateUser = async () => {
    try {
      // 1. Create auth user (via edge function or api)
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          phone_number: newUser.phone_number,
          role: newUser.role,
          group_ids: newUser.group_ids
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Bruker opprettet",
        description: `${newUser.full_name} er lagt til i systemet`,
      });

      fetchData();
      setNewUser({
        email: "",
        full_name: "",
        phone_number: "",
        role: "member",
        group_ids: [],
        password: "",
      });
    } catch (error: any) {
      toast({
        title: "Feil ved opprettelse",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateGroup = async () => {
    try {
      // Get tenant_id from current user or context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // For MVP, just use user ID as tenant placeholder or fetch actual tenant
      const tenant_id = user.id; // This is wrong in multi-tenant, but ok for now as we don't have tenant context ready

      await groupService.createGroup({
        ...newGroup,
        tenant_id
      });

      toast({
        title: "Gruppe opprettet",
        description: `${newGroup.name} er klar til bruk`,
      });

      fetchData();
      setNewGroup({
        name: "",
        description: "",
        kind: "operational",
        parent_id: "none",
        escalation_enabled: false,
        escalation_timeout_minutes: 30,
        min_on_duty_count: 1,
      });
    } catch (error: any) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateGateway = async (gatewayData: any) => {
    try {
      await gatewayService.create(gatewayData);
      toast({
        title: "Gateway opprettet",
        description: "Den nye gatewayen er lagt til",
      });
      fetchData();
    } catch (error: any) {
      console.error("Failed to create gateway:", error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke opprette gateway",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    toast({
       title: "Ikke implementert",
       description: "Sletting av brukere krever admin-tilgang til Auth API",
       variant: "default"
    });
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await groupService.deleteGroup(groupId);
      toast({
        title: "Gruppe slettet",
        description: "Gruppen er fjernet fra systemet",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteGateway = async (gatewayId: string) => {
    try {
      await gatewayService.delete(gatewayId);
      toast({
        title: "Gateway slettet",
        description: "Gatewayen er fjernet",
      });
      fetchData();
    } catch (error: any) {
      console.error("Failed to delete gateway:", error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke slette gateway",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Admin</h1>
            <p className="text-muted-foreground">
              Administrer brukere, grupper og systeminnstillinger
            </p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Brukere
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Grupper & Tilgang
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center gap-2">
              <Router className="h-4 w-4" />
              Ruting & Gateways
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Audit Logg
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Brukere</CardTitle>
                  <CardDescription>
                    Oversikt over alle registrerte brukere i systemet
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Ny Bruker
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Opprett ny bruker</DialogTitle>
                      <DialogDescription>
                        Legg til en ny bruker med tilgangsnivå
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Navn</Label>
                        <Input
                          value={newUser.full_name}
                          onChange={(e) =>
                            setNewUser({ ...newUser, full_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>E-post</Label>
                        <Input
                          value={newUser.email}
                          onChange={(e) =>
                            setNewUser({ ...newUser, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Passord</Label>
                        <Input
                          type="password"
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser({ ...newUser, password: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Telefon</Label>
                        <Input
                          value={newUser.phone_number}
                          onChange={(e) =>
                            setNewUser({ ...newUser, phone_number: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Rolle</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value) =>
                            setNewUser({ ...newUser, role: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Medlem</SelectItem>
                            <SelectItem value="group_admin">Gruppe Admin</SelectItem>
                            <SelectItem value="tenant_admin">System Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateUser}>Opprett bruker</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="flex items-center py-4">
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søk etter navn eller e-post..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>E-post</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead>Grupper</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.full_name}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {/* Display group names if available via joins */}
                            <span className="text-sm text-muted-foreground">
                              {(user as any).group_memberships?.map((gm: any) => gm.groups?.name).join(", ") || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.deleted_at ? "destructive" : "default"}>
                              {user.deleted_at ? "Inaktiv" : "Aktiv"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Gruppe-hierarki</CardTitle>
                  <CardDescription>
                    Visuell fremstilling av organisasjonsstrukturen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GroupHierarchy groups={(() => {
                    const buildHierarchy = (parentId: string | null = null): any[] => {
                      return groups
                        .filter(g => g.parent_group_id === (parentId === "none" ? null : parentId))
                        .map(g => ({
                          id: g.id,
                          name: g.name,
                          kind: g.kind as "operational" | "structural",
                          parent_id: g.parent_group_id,
                          description: (g as any).description,
                          member_count: g.active_members,
                          children: buildHierarchy(g.id)
                        }));
                    };
                    return buildHierarchy(null);
                  })()} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ny Gruppe</CardTitle>
                  <CardDescription>Opprett en ny enhet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Navn</Label>
                    <Input
                      value={newGroup.name}
                      onChange={(e) =>
                        setNewGroup({ ...newGroup, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newGroup.kind}
                      onValueChange={(value) =>
                        setNewGroup({ ...newGroup, kind: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operational">Operasjonell</SelectItem>
                        <SelectItem value="administrative">Administrativ</SelectItem>
                        <SelectItem value="billing">Fakturering</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Forelder-gruppe</Label>
                    <Select
                      value={newGroup.parent_id}
                      onValueChange={(value) =>
                        setNewGroup({ ...newGroup, parent_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Velg forelder..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ingen (Toppnivå)</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={newGroup.escalation_enabled}
                      onCheckedChange={(checked) => 
                        setNewGroup({ ...newGroup, escalation_enabled: checked })
                      }
                    />
                    <Label>Aktiver eskalering</Label>
                  </div>

                  {newGroup.escalation_enabled && (
                    <div className="space-y-2">
                      <Label>Timeout (minutter)</Label>
                      <Input
                        type="number"
                        value={newGroup.escalation_timeout_minutes}
                        onChange={(e) =>
                          setNewGroup({ ...newGroup, escalation_timeout_minutes: parseInt(e.target.value) })
                        }
                      />
                    </div>
                  )}

                  <Button onClick={handleCreateGroup} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Opprett Gruppe
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Alle Grupper</CardTitle>
              </CardHeader>
              <CardContent>
                 <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Medlemmer</TableHead>
                        <TableHead>Eskalering</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map((group) => (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">{group.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{group.kind}</Badge>
                          </TableCell>
                          <TableCell>{group.active_members || 0}</TableCell>
                          <TableCell>
                            {group.escalation_enabled ? (
                              <Badge variant="secondary">{group.escalation_timeout_minutes}m</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteGroup(group.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
             <div className="grid gap-4 md:grid-cols-2">
               {/* Gateways Section */}
               <Card>
                 <CardHeader>
                   <CardTitle>SMS Gateways</CardTitle>
                   <CardDescription>Konfigurer leverandører for SMS-utsendelse</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="space-y-4 border p-4 rounded-md">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Navn</Label>
                          <Input 
                            placeholder="Provider Name"
                            value={newGateway.name}
                            onChange={(e) => setNewGateway({...newGateway, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Telefonnummer</Label>
                          <Input 
                            placeholder="+47..."
                            value={newGateway.phone_number}
                            onChange={(e) => setNewGateway({...newGateway, phone_number: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input 
                            type="password"
                            placeholder="Secret Key"
                            value={newGateway.api_key}
                            onChange={(e) => setNewGateway({...newGateway, api_key: e.target.value})}
                          />
                        </div>
                         <div className="space-y-2">
                          <Label>Base URL</Label>
                          <Input 
                            placeholder="https://api..."
                            value={newGateway.base_url}
                            onChange={(e) => setNewGateway({...newGateway, base_url: e.target.value})}
                          />
                        </div>
                      </div>
                      <Button onClick={() => handleCreateGateway(newGateway)} size="sm" className="w-full">
                        <Plus className="mr-2 h-4 w-4" /> Legg til Gateway
                      </Button>
                    </div>

                    <div className="space-y-2 mt-4">
                      {gateways.map(gw => (
                        <div key={gw.id} className="flex items-center justify-between p-3 border rounded bg-secondary/10">
                          <div>
                            <div className="font-medium">{gw.name}</div>
                            <div className="text-sm text-muted-foreground">{gw.phone_number}</div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={gw.status === 'active' ? 'default' : 'secondary'}>
                              {gw.status}
                            </Badge>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteGateway(gw.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                 </CardContent>
               </Card>

               {/* Routing Rules Section */}
               <Card>
                 <CardHeader>
                   <CardTitle>Rutingsregler</CardTitle>
                   <CardDescription>Styr hvordan innkommende meldinger rutes</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <RoutingRulesTab />
                 </CardContent>
               </Card>
             </div>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Revisjonslogg</CardTitle>
                <CardDescription>
                  Logg over alle sensitive handlinger i systemet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tidspunkt</TableHead>
                      <TableHead>Bruker</TableHead>
                      <TableHead>Handling</TableHead>
                      <TableHead>Detaljer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{(log as any).user_profiles?.full_name || "System"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {JSON.stringify(log.metadata)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}