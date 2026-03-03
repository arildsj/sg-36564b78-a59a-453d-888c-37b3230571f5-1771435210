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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Trash2, Shield, Settings, Server, Users, Activity, Router, Pencil } from "lucide-react";
import { GroupHierarchy } from "@/components/GroupHierarchy";
import { RoutingRulesTab } from "@/components/settings/RoutingRulesTab";
import { supabase } from "@/integrations/supabase/client";
import { gatewayService, type Gateway } from "@/services/gatewayService";
import { groupService, type Group } from "@/services/groupService";
import { userService, type UserProfile } from "@/services/userService";
import { auditService, type AuditLogEntry } from "@/services/auditService";
import { adminPermissionService } from "@/services/adminPermissionService";

const db = supabase as any;

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userRole, setUserRole] = useState<string>("member");

  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    phone: "", // FASIT: phone
    role: "member",
    group_ids: [] as string[],
    admin_group_ids: [] as string[], // NEW: For group_admin permissions during creation
    password: "",
  });

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserData, setEditUserData] = useState({
    full_name: "",
    email: "",
    phone: "", // FASIT: phone
    role: "",
    group_ids: [] as string[],
    admin_group_ids: [] as string[], // NEW: For group_admin permissions
  });

  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    kind: "operational",
    parent_id: "none",
    gateway_id: "",
    escalation_enabled: false,
    escalation_timeout_minutes: 30,
    min_on_duty_count: 1,
  });

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupData, setEditGroupData] = useState({
    name: "",
    description: "",
    kind: "operational",
    parent_id: "",
    gateway_id: "",
    escalation_enabled: false,
    escalation_timeout_minutes: 30,
    min_on_duty_count: 1,
  });

  const [newGateway, setNewGateway] = useState({
    name: "",
    gateway_description: "",
    api_key: "",
    api_secret: "",
    sender_id: "",
    webhook_secret: "",
    is_active: true,
    base_url: "",
    gw_phone: "",
  });

  useEffect(() => {
    if (editingUser) {
      const loadAdminPermissions = async () => {
        if (editingUser.role === "group_admin") {
          const { groupIds } = await adminPermissionService.getAdminPermissions(editingUser.id);
          setEditUserData({
            full_name: editingUser.full_name || "",
            email: editingUser.email || "",
            phone: editingUser.phone || "",
            role: editingUser.role || "member",
            group_ids: (editingUser as any).group_memberships?.map((gm: any) => gm.group_id) || [],
            admin_group_ids: groupIds || [],
          });
        } else {
          setEditUserData({
            full_name: editingUser.full_name || "",
            email: editingUser.email || "",
            phone: editingUser.phone || "",
            role: editingUser.role || "member",
            group_ids: (editingUser as any).group_memberships?.map((gm: any) => gm.group_id) || [],
            admin_group_ids: [],
          });
        }
      };
      loadAdminPermissions();
    }
  }, [editingUser]);

  useEffect(() => {
    if (editingGroup) {
      setEditGroupData({
        name: editingGroup.name,
        description: (editingGroup as any).description || "",
        kind: editingGroup.kind,
        parent_id: editingGroup.parent_id || "none",
        gateway_id: (editingGroup as any).gateway_id || "",
        escalation_enabled: editingGroup.escalation_enabled || false,
        escalation_timeout_minutes: editingGroup.escalation_timeout_minutes || 30,
        min_on_duty_count: editingGroup.min_on_duty_count || 1,
      });
    }
  }, [editingGroup]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await db
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setUserRole(profile.role);
        }
      }

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

      // FASIT: groups table
      const { data: groupsData, error: groupsError } = await db
        .from("groups")
        .select("*")
        .order("name", { ascending: true });

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      const { data: gatewaysData, error: gatewaysError } = await db
        .from("sms_gateways")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (gatewaysError) throw gatewaysError;
      setGateways(gatewaysData || []);

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
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast({
            title: "Ikke autentisert",
            description: "Du må logge inn for å se admin-panelet",
            variant: "destructive",
          });
          return;
        }

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Hent innlogget brukers tenant_id fra user_profiles
      const { data: currentUserProfile, error: profileError } = await db
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", session.user.id)
        .single();

      if (profileError || !currentUserProfile?.tenant_id) {
        throw new Error("Could not find tenant for current user");
      }

      const response = await fetch("/api/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          phone: newUser.phone, // FASIT: phone
          role: newUser.role,
          tenant_id: currentUserProfile.tenant_id,
          group_ids: newUser.group_ids,
          admin_group_ids: newUser.admin_group_ids, // NEW: Send admin permissions
          granted_by: session?.user?.id, // NEW: ID of the admin creating the user
        }),
      });

      console.log("📤 API Request:", {
        email: newUser.email,
        full_name: newUser.full_name,
        phone: newUser.phone,
        role: newUser.role,
        tenant_id: currentUserProfile.tenant_id,
        group_ids: newUser.group_ids,
        admin_group_ids: newUser.admin_group_ids,
        password: "***"
      });

      console.log("📥 API Response Status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to create user");
      }

      const result = await response.json();

      toast({
        title: "Bruker opprettet",
        description: `${newUser.full_name} er lagt til i systemet`,
      });

      fetchData();
      setNewUser({
        email: "",
        full_name: "",
        phone: "",
        role: "member",
        group_ids: [],
        admin_group_ids: [], // NEW: Reset admin permissions
        password: "",
      });
    } catch (error: any) {
      console.error("Failed to create user:", error);
      toast({
        title: "Feil ved opprettelse",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const { error: profileError } = await db
        .from("user_profiles")
        .update({
          full_name: editUserData.full_name,
          email: editUserData.email,
          phone: editUserData.phone, // FASIT: phone
          role: editUserData.role,
        })
        .eq("id", editingUser.id);

      if (profileError) throw profileError;

      const { error: deleteMembershipsError } = await db
        .from("group_memberships")
        .delete()
        .eq("user_id", editingUser.id);

      if (deleteMembershipsError) throw deleteMembershipsError;

      if (editUserData.group_ids.length > 0) {
        const memberships = editUserData.group_ids.map(groupId => ({
          user_id: editingUser.id,
          group_id: groupId,
        }));

        const { error: insertError } = await db
          .from("group_memberships")
          .insert(memberships);

        if (insertError) throw insertError;
      }

      // Handle admin permissions for group_admin role
      if (editUserData.role === "group_admin") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: currentUserProfile } = await db
          .from("user_profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (!currentUserProfile?.tenant_id) throw new Error("Could not find tenant");

        // Get current permissions
        const { groupIds: currentPermissions } = await adminPermissionService.getAdminPermissions(editingUser.id);

        // Find permissions to add
        const toAdd = editUserData.admin_group_ids.filter(gid => !currentPermissions?.includes(gid));

        // Find permissions to remove
        const toRemove = currentPermissions?.filter(gid => !editUserData.admin_group_ids.includes(gid)) || [];

        // Grant new permissions
        for (const groupId of toAdd) {
          await adminPermissionService.grantAdminPermission(
            editingUser.id,
            groupId,
            currentUserProfile.tenant_id
          );
        }

        // Revoke removed permissions
        for (const groupId of toRemove) {
          await adminPermissionService.revokeAdminPermission(editingUser.id, groupId);
        }
      }

      toast({
        title: "Bruker oppdatert",
        description: `${editUserData.full_name} er oppdatert`,
      });

      setEditingUser(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Feil ved oppdatering",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;

    try {
      await groupService.updateGroup(editingGroup.id, {
        name: editGroupData.name,
        description: editGroupData.description,
        kind: editGroupData.kind,
        parent_id: editGroupData.parent_id === "none" ? null : editGroupData.parent_id,
        gateway_id: editGroupData.parent_id === "none" ? editGroupData.gateway_id : null,
        escalation_enabled: editGroupData.escalation_enabled,
        escalation_timeout_minutes: editGroupData.escalation_timeout_minutes,
        min_on_duty_count: editGroupData.min_on_duty_count,
      });

      toast({
        title: "Gruppe oppdatert",
        description: `${editGroupData.name} er oppdatert`,
      });

      setEditingGroup(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Feil ved oppdatering",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateGroup = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (newGroup.parent_id === "none" && !newGroup.gateway_id) {
        toast({
          title: "Gateway mangler",
          description: "Du må velge en gateway for rotgrupper",
          variant: "destructive",
        });
        return;
      }

      const tenant_id = user.id;

      const groupData = {
        name: newGroup.name,
        description: newGroup.description,
        kind: newGroup.kind,
        parent_id: newGroup.parent_id === "none" ? null : newGroup.parent_id,
        gateway_id: newGroup.parent_id === "none" ? newGroup.gateway_id : null,
        tenant_id,
        escalation_enabled: newGroup.escalation_enabled,
        escalation_timeout_minutes: newGroup.escalation_timeout_minutes,
        min_on_duty_count: newGroup.min_on_duty_count,
      };

      await groupService.createGroup(groupData);

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
        gateway_id: "",
        escalation_enabled: false,
        escalation_timeout_minutes: 30,
        min_on_duty_count: 1,
      });
    } catch (error: any) {
      console.error("Failed to create group:", error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke opprette gruppe",
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
      setNewGateway({
        name: "",
        gateway_description: "",
        api_key: "",
        api_secret: "",
        sender_id: "",
        webhook_secret: "",
        is_active: true,
        base_url: "",
        gw_phone: "",
      });
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
            <TabsTrigger value="gateways" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              SMS Gateways
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center gap-2">
              <Router className="h-4 w-4" />
              Rutingsregler
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
                      <DialogTitle id="create-user-dialog-title">Opprett ny bruker</DialogTitle>
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
                          value={newUser.phone}
                          onChange={(e) =>
                            setNewUser({ ...newUser, phone: e.target.value })
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
                      <div className="grid gap-2">
                        <Label>Grupper</Label>
                        <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                          {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Ingen grupper tilgjengelig</p>
                          ) : (
                            groups.map((group) => (
                              <div key={group.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`new-user-group-${group.id}`}
                                  checked={newUser.group_ids.includes(group.id)}
                                  onCheckedChange={(checked) => {
                                    setNewUser({
                                      ...newUser,
                                      group_ids: checked
                                        ? [...newUser.group_ids, group.id]
                                        : newUser.group_ids.filter((id) => id !== group.id),
                                    });
                                  }}
                                />
                                <Label
                                  htmlFor={`new-user-group-${group.id}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {group.name}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Grupper å administrere</Label>
                        <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto bg-muted/30">
                          {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Ingen grupper tilgjengelig</p>
                          ) : (
                            groups.map((group) => (
                              <div key={group.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`new-user-admin-group-${group.id}`}
                                  checked={newUser.admin_group_ids.includes(group.id)}
                                  onCheckedChange={(checked) => {
                                    setNewUser({
                                      ...newUser,
                                      admin_group_ids: checked
                                        ? [...newUser.admin_group_ids, group.id]
                                        : newUser.admin_group_ids.filter((id) => id !== group.id),
                                    });
                                  }}
                                />
                                <Label
                                  htmlFor={`new-user-admin-group-${group.id}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {group.name}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Velg hvilke grupper denne group_admin kan administrere
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      {newUser.group_ids.length === 0 && (
                        <p className="text-sm text-destructive mr-auto">
                          ⚠️ Velg minst én gruppe
                        </p>
                      )}
                      <Button 
                        onClick={handleCreateUser}
                        disabled={newUser.group_ids.length === 0}
                      >
                        Opprett bruker
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle id="edit-user-dialog-title">Rediger bruker</DialogTitle>
                    <DialogDescription>
                      Oppdater brukerens informasjon og gruppemedlemskap
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Navn</Label>
                      <Input
                        value={editUserData.full_name}
                        onChange={(e) =>
                          setEditUserData({ ...editUserData, full_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>E-post</Label>
                      <Input
                        value={editUserData.email}
                        onChange={(e) =>
                          setEditUserData({ ...editUserData, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Telefon</Label>
                      <Input
                        value={editUserData.phone}
                        onChange={(e) =>
                          setEditUserData({ ...editUserData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Rolle</Label>
                      <Select
                        value={editUserData.role}
                        onValueChange={(value) =>
                          setEditUserData({ ...editUserData, role: value })
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
                    
                    {editUserData.role === "group_admin" && (
                      <div className="grid gap-2">
                        <Label>Grupper å administrere</Label>
                        <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto bg-muted/30">
                          {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Ingen grupper tilgjengelig</p>
                          ) : (
                            groups.map((group) => (
                              <div key={group.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`admin-group-${group.id}`}
                                  checked={editUserData.admin_group_ids.includes(group.id)}
                                  onCheckedChange={(checked) => {
                                    setEditUserData({
                                      ...editUserData,
                                      admin_group_ids: checked
                                        ? [...editUserData.admin_group_ids, group.id]
                                        : editUserData.admin_group_ids.filter((id) => id !== group.id),
                                    });
                                  }}
                                />
                                <Label
                                  htmlFor={`admin-group-${group.id}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {group.name}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Velg hvilke grupper denne group_admin kan administrere
                        </p>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label>Grupper</Label>
                      <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                        {groups.map((group) => (
                          <div key={group.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`group-${group.id}`}
                              checked={editUserData.group_ids.includes(group.id)}
                              onCheckedChange={(checked) => {
                                setEditUserData({
                                  ...editUserData,
                                  group_ids: checked
                                    ? [...editUserData.group_ids, group.id]
                                    : editUserData.group_ids.filter((id) => id !== group.id),
                                });
                              }}
                            />
                            <Label
                              htmlFor={`group-${group.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {group.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingUser(null)}>
                      Avbryt
                    </Button>
                    <Button onClick={handleUpdateUser}>Lagre endringer</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingUser(user)}
                                title="Rediger bruker"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(user.id)}
                                title="Slett bruker"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Grupper & Tilgang</CardTitle>
                  <CardDescription>
                    Administrer organisasjonsstrukturen
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Ny Gruppe
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle id="create-group-dialog-title">Opprett ny gruppe</DialogTitle>
                      <DialogDescription>
                        Legg til en ny gruppe i organisasjonen
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Navn</Label>
                        <Input
                          value={newGroup.name}
                          onChange={(e) =>
                            setNewGroup({ ...newGroup, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Beskrivelse</Label>
                        <Input
                          value={newGroup.description}
                          onChange={(e) =>
                            setNewGroup({ ...newGroup, description: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
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
                      <div className="grid gap-2">
                        <Label>Forelder-gruppe</Label>
                        <Select
                          value={newGroup.parent_id}
                          onValueChange={(value) =>
                            setNewGroup({ ...newGroup, parent_id: value, gateway_id: value === "none" ? newGroup.gateway_id : "" })
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

                      {userRole === "tenant_admin" && newGroup.parent_id === "none" && (
                        <div className="grid gap-2">
                          <Label>Gateway <span className="text-destructive">*</span></Label>
                          <Select
                            value={newGroup.gateway_id}
                            onValueChange={(value) =>
                              setNewGroup({ ...newGroup, gateway_id: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Velg gateway..." />
                            </SelectTrigger>
                            <SelectContent>
                              {gateways.filter(gw => gw.is_active).map((gw) => (
                                <SelectItem key={gw.id} value={gw.id}>
                                  {gw.name} ({gw.gw_phone || "Ingen telefon"})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Rotgrupper må ha en gateway tilknyttet
                          </p>
                        </div>
                      )}
                      
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
                        <div className="grid gap-2">
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
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleCreateGroup}
                        disabled={
                          !newGroup.name || 
                          (newGroup.parent_id === "none" && userRole === "tenant_admin" && !newGroup.gateway_id)
                        }
                      >
                        Opprett Gruppe
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="border rounded-lg p-4 bg-muted/20">
                  <h3 className="font-semibold mb-3 text-sm">Gruppe-hierarki</h3>
                  <GroupHierarchy groups={(() => {
                    const buildHierarchy = (parentId: string | null = null): any[] => {
                      return groups
                        .filter(g => g.parent_id === (parentId === "none" ? null : parentId))
                        .map(g => ({
                          id: g.id,
                          name: g.name,
                          kind: g.kind as "operational" | "structural",
                          parent_id: g.parent_id,
                          description: (g as any).description,
                          member_count: g.active_members,
                          children: buildHierarchy(g.id)
                        }));
                    };
                    return buildHierarchy(null);
                  })()} />
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Alle Grupper</h3>
                  <div className="rounded-md border">
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
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingGroup(group)}
                                  title="Rediger gruppe"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteGroup(group.id)}
                                  title="Slett gruppe"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle id="edit-group-dialog-title">Rediger gruppe</DialogTitle>
                  <DialogDescription>
                    Oppdater gruppens informasjon og innstillinger
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Navn</Label>
                    <Input
                      value={editGroupData.name}
                      onChange={(e) =>
                        setEditGroupData({ ...editGroupData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Beskrivelse</Label>
                    <Input
                      value={editGroupData.description}
                      onChange={(e) =>
                        setEditGroupData({ ...editGroupData, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select
                      value={editGroupData.kind}
                      onValueChange={(value) =>
                        setEditGroupData({ ...editGroupData, kind: value })
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
                  <div className="grid gap-2">
                    <Label>Forelder-gruppe</Label>
                    <Select
                      value={editGroupData.parent_id || "none"}
                      onValueChange={(value) =>
                        setEditGroupData({ 
                          ...editGroupData, 
                          parent_id: value === "none" ? "" : value,
                          gateway_id: value === "none" ? editGroupData.gateway_id : ""
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ingen (Toppnivå)</SelectItem>
                        {groups
                          .filter(g => g.id !== editingGroup?.id)
                          .map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {userRole === "tenant_admin" && (editGroupData.parent_id === "none" || !editGroupData.parent_id) && (
                    <div className="grid gap-2">
                      <Label>Gateway</Label>
                      <Select
                        value={editGroupData.gateway_id}
                        onValueChange={(value) =>
                          setEditGroupData({ ...editGroupData, gateway_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Velg gateway..." />
                        </SelectTrigger>
                        <SelectContent>
                          {gateways.filter(gw => gw.is_active).map((gw) => (
                            <SelectItem key={gw.id} value={gw.id}>
                              {gw.name} ({gw.gw_phone || "Ingen telefon"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={editGroupData.escalation_enabled}
                      onCheckedChange={(checked) =>
                        setEditGroupData({ ...editGroupData, escalation_enabled: checked })
                      }
                    />
                    <Label>Aktiver eskalering</Label>
                  </div>

                  {editGroupData.escalation_enabled && (
                    <div className="grid gap-2">
                      <Label>Timeout (minutter)</Label>
                      <Input
                        type="number"
                        value={editGroupData.escalation_timeout_minutes}
                        onChange={(e) =>
                          setEditGroupData({ 
                            ...editGroupData, 
                            escalation_timeout_minutes: parseInt(e.target.value) 
                          })
                        }
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingGroup(null)}>
                    Avbryt
                  </Button>
                  <Button onClick={handleUpdateGroup}>Lagre endringer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="gateways" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SMS Gateways</CardTitle>
                <CardDescription>Konfigurer leverandører for SMS-utsendelse</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 border p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gateway Navn</Label>
                      <Input 
                        placeholder="Helse Gateway"
                        value={newGateway.name}
                        onChange={(e) => setNewGateway({...newGateway, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefonnummer</Label>
                      <Input 
                        placeholder="+47..."
                        value={newGateway.gw_phone}
                        onChange={(e) => setNewGateway({...newGateway, gw_phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input 
                        placeholder="https://semse.iotcrafts.in/"
                        value={newGateway.base_url}
                        onChange={(e) => setNewGateway({...newGateway, base_url: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input 
                        type="password"
                        placeholder="Hemmelig API-nøkkel"
                        value={newGateway.api_key}
                        onChange={(e) => setNewGateway({...newGateway, api_key: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gateway_description">Beskrivelse</Label>
                      <Input
                        id="gateway_description"
                        placeholder="F.eks. Primær SMS-gateway for Norge"
                        value={newGateway.gateway_description}
                        onChange={(e) =>
                          setNewGateway({ ...newGateway, gateway_description: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhook_secret">Webhook Secret</Label>
                      <Input
                        id="webhook_secret"
                        type="password"
                        placeholder="Valgfritt"
                        value={newGateway.webhook_secret}
                        onChange={(e) =>
                          setNewGateway({ ...newGateway, webhook_secret: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button onClick={() => handleCreateGateway(newGateway)} size="sm" className="w-full mt-4">
                    <Plus className="mr-2 h-4 w-4" /> Legg til Gateway
                  </Button>
                </div>

                <div className="space-y-2 mt-4">
                  {gateways.length === 0 ? (
                    <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                      Ingen gateways konfigurert ennå
                    </div>
                  ) : (
                    gateways.map(gw => (
                      <div key={gw.id} className="flex items-center justify-between p-3 border rounded bg-secondary/10">
                        <div>
                          <div className="font-medium">{gw.name}</div>
                          <div className="text-sm text-muted-foreground">{gw.base_url}</div>
                          <div className="text-xs text-muted-foreground">{gw.gw_phone || "Ingen telefon"}</div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={gw.is_active ? 'default' : 'secondary'}>
                            {gw.is_active ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteGateway(gw.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rutingsregler</CardTitle>
                <CardDescription>
                  Styr hvordan innkommende meldinger rutes til riktig gruppe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gateways.length === 0 ? (
                  <div className="text-center p-8 border rounded-lg border-dashed">
                    <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">Ingen gateways funnet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Du må først legge til en SMS gateway før du kan opprette rutingsregler
                    </p>
                    <Button variant="outline" onClick={() => {
                      const tabsList = document.querySelector('[role="tablist"]');
                      const gatewaysTab = tabsList?.querySelector('[value="gateways"]') as HTMLElement;
                      gatewaysTab?.click();
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Gå til SMS Gateways
                    </Button>
                  </div>
                ) : (
                  <RoutingRulesTab />
                )}
              </CardContent>
            </Card>
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