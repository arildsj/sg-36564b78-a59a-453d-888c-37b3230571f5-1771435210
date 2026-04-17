import { useState, useEffect } from "react";
import Head from "next/head";
import { useLanguage } from "@/contexts/LanguageProvider";
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
import { Plus, Search, Trash2, Shield, Settings, Server, Users, Activity, Router, Pencil, AlertTriangle, Filter, ChevronDown, ChevronRight, X } from "lucide-react";
import { GroupHierarchy } from "@/components/GroupHierarchy";
import { RoutingRulesTab } from "@/components/settings/RoutingRulesTab";
import { GroupDetailPanel } from "@/components/admin/GroupDetailPanel";
import { supabase } from "@/integrations/supabase/client";
import { gatewayService, type Gateway } from "@/services/gatewayService";
import { groupService, type Group } from "@/services/groupService";
import { userService, type UserProfile } from "@/services/userService";
import { auditService, type AuditLogEntry, type AuditLogFilter } from "@/services/auditService";
import { adminPermissionService } from "@/services/adminPermissionService";

const db = supabase as any;

export default function AdminPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const appCommit = process.env.NEXT_PUBLIC_APP_COMMIT || t("admin.unknown");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMembers, setActiveMembers] = useState<Record<string, number>>({});
  const [auditFilter, setAuditFilter] = useState<AuditLogFilter>({
    group_id:   "",
    user_id:    "",
    event_type: "",
  });
  const [userRole, setUserRole] = useState<string>("member");
  const [tenantId, setTenantId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

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
    min_active: 0,
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
    min_active: 0,
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

  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);
  const [editGatewayData, setEditGatewayData] = useState({
    name: "",
    gw_phone: "",
    base_url: "",
    api_key: "",
    api_secret: "",
    webhook_secret: "",
    gateway_description: "",
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
        min_active: (editingGroup as any).min_active ?? 0,
      });
    }
  }, [editingGroup]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      console.log("🔐 Current logged in user:", user?.id);
      
      if (user) {
        const { data: profile } = await db
          .from("user_profiles")
          .select("role, tenant_id")
          .eq("id", user.id)
          .single();
        
        console.log("👤 Current user profile:", profile);
        
        if (profile) {
          setUserRole(profile.role);
          setTenantId(profile.tenant_id);
        }
      }

      // FIXED: Simplified query without nested joins to avoid RLS issues
      const { data: usersData, error: usersError } = await db
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("📊 Raw usersData:", usersData);
      console.log("❌ usersError:", usersError);

      if (usersError) {
        console.error("Error fetching users:", usersError);
        throw usersError;
      }

      console.log("👥 Fetched users count:", usersData?.length || 0);
      console.log("👥 User IDs:", usersData?.map(u => ({ id: u.id, name: u.full_name, role: u.role })));

      // Fetch group memberships separately
      if (usersData && usersData.length > 0) {
        const userIds = usersData.map(u => u.id);
        console.log("🔗 Fetching memberships for user IDs:", userIds);

        const { data: memberships, error: membershipsError } = await db
          .from("group_memberships")
          .select(`
            user_id,
            group_id,
            groups (
              name
            )
          `)
          .in("user_id", userIds);

        console.log("🔗 Raw memberships:", memberships);
        console.log("❌ membershipsError:", membershipsError);

        if (membershipsError) {
          console.error("Error fetching memberships:", membershipsError);
        } else {
          console.log("🔗 Fetched memberships count:", memberships?.length || 0);
          
          // Attach memberships to users
          const usersWithMemberships = usersData.map(user => {
            const userMemberships = memberships?.filter(m => m.user_id === user.id) || [];
            console.log(`👤 ${user.full_name} memberships:`, userMemberships);
            
            return {
              ...user,
              group_memberships: userMemberships
            };
          });
          
          console.log("✅ Final users with memberships:", usersWithMemberships);
          setUsers(usersWithMemberships);
        }
      } else {
        console.log("⚠️ No users data, setting empty array");
        setUsers(usersData || []);
      }

      // FASIT: groups table
      const { data: groupsData, error: groupsError } = await db
        .from("groups")
        .select("*")
        .order("name", { ascending: true });

      console.log("📦 Raw groupsData:", groupsData);
      console.log("❌ groupsError:", groupsError);

      if (groupsError) {
        console.error("Error fetching groups:", groupsError);
        toast({
          title: "Feil ved henting av grupper",
          description: groupsError.message,
          variant: "destructive",
        });
      } else {
        console.log("✅ Fetched groups count:", groupsData?.length || 0);
        setGroups(groupsData || []);
      }

      const { data: gatewaysData, error: gatewaysError } = await db
        .from("sms_gateways")
        .select("*")
        .order("created_at", { ascending: false });
      
      console.log("📡 Raw gatewaysData:", gatewaysData);
      console.log("❌ gatewaysError:", gatewaysError);

      if (gatewaysError) {
        console.error("Error fetching gateways:", gatewaysError);
        toast({
          title: "Feil ved henting av gateways",
          description: gatewaysError.message,
          variant: "destructive",
        });
      } else {
        console.log("✅ Fetched gateways count:", gatewaysData?.length || 0);
        setGateways(gatewaysData || []);
      }

      const logs = await auditService.getAuditLogs(100, {
        group_id:   auditFilter.group_id   || undefined,
        user_id:    auditFilter.user_id    || undefined,
        event_type: auditFilter.event_type || undefined,
      });
      setAuditLogs(logs);

      // Fetch active member counts per group
      const { data: activeCounts } = await db
        .from("group_memberships")
        .select("group_id")
        .eq("is_active", true);

      const countMap: Record<string, number> = {};
      (activeCounts || []).forEach((m: any) => {
        countMap[m.group_id] = (countMap[m.group_id] || 0) + 1;
      });
      setActiveMembers(countMap);

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
            title: t("admin.not_authenticated"),
            description: t("admin.login_required"),
            variant: "destructive",
          });
          return;
        }

        await fetchData();
      } catch (error: any) {
        console.error("Auth check failed:", error);
        toast({
          title: t("admin.auth_error"),
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
      // Hent brukerens tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: currentUserProfile } = await db
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!currentUserProfile?.tenant_id) throw new Error("Could not find tenant");

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
          tenant_id: currentUserProfile.tenant_id,
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
      const memberCount = Object.keys(activeMembers).length; // rough bound check done server-side
      if (editGroupData.min_active < 0) {
        toast({ title: t("admin.invalid_value"), description: t("admin.min_active_negative"), variant: "destructive" });
        return;
      }

      await groupService.updateGroup(editingGroup.id, {
        name: editGroupData.name,
        description: editGroupData.description,
        kind: editGroupData.kind,
        parent_id: editGroupData.parent_id === "none" ? null : editGroupData.parent_id,
        gateway_id: editGroupData.parent_id === "none" ? editGroupData.gateway_id : null,
        escalation_enabled: editGroupData.escalation_enabled,
        escalation_timeout_minutes: editGroupData.escalation_timeout_minutes,
        min_on_duty_count: editGroupData.min_on_duty_count,
        min_active: editGroupData.min_active,
      } as any);

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
          title: t("admin.gateway_missing"),
          description: t("admin.root_needs_gateway"),
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
        min_active: newGroup.min_active,
      };

      await groupService.createGroup(groupData);

      toast({
        title: "Gruppe opprettet",
        description: `${newGroup.name} er klar til bruk`,
      });

      setCreateGroupOpen(false);
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
        min_active: 0,
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
      await gatewayService.create({ ...gatewayData, tenant_id: tenantId });
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

  const handleOpenEditGateway = (gw: Gateway) => {
    setEditingGateway(gw);
    setEditGatewayData({
      name:                gw.name || "",
      gw_phone:            gw.gw_phone || "",
      base_url:            gw.base_url || "",
      api_key:             (gw as any).api_key || "",
      api_secret:          (gw as any).api_secret || "",
      webhook_secret:      (gw as any).webhook_secret || "",
      gateway_description: (gw as any).gateway_description || "",
    });
  };

  const handleSaveGateway = async () => {
    if (!editingGateway) return;
    try {
      await gatewayService.update(editingGateway.id, editGatewayData);
      toast({ title: "Gateway oppdatert", description: "Endringene er lagret" });
      setEditingGateway(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Feil", description: error.message || "Kunne ikke oppdatere gateway", variant: "destructive" });
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

  const formatAuditMetadata = (log: AuditLogEntry): string => {
    const m = (log.metadata || log.old_data) as Record<string, unknown> | null;
    if (!m) return "—";
    const et = log.event_type || log.action;
    if (et === "rule_matched") {
      return `${t("admin.audit_sender")} ${m.sender ?? "?"} → ${t("admin.audit_rule")} "${m.matched_rule_name ?? "?"}" (${m.match_type ?? "?"})`;
    }
    if (et === "min_active_changed") {
      return `${m.group_name ?? ""}: min_active ${m.old_value} → ${m.new_value}`;
    }
    if (et === "admin_override") {
      const dir = m.set_active ? t("admin.audit_activated") : t("admin.audit_deactivated");
      return `${m.group_name ?? ""}: ${t("admin.user_label")} ${dir}${m.reason ? ` — ${m.reason}` : ""}`;
    }
    if (et === "activation_requested") {
      return `${m.group_name ?? ""}: ${t("admin.audit_request_sent")} ${(m.requested_user_ids as string[] | undefined)?.length ?? 0} ${t("admin.audit_users")}`;
    }
    if (et === "activation_confirmed") return `${m.group_name ?? ""}: ${t("admin.audit_user_activated")}`;
    if (et === "activation_rejected")  return `${m.group_name ?? ""}: ${t("admin.audit_user_rejected")}`;
    if (et === "activated")            return `${m.group_name ?? ""}: ${t("admin.audit_user_activated")}`;
    if (et === "deactivated")          return `${m.group_name ?? ""}: ${t("admin.audit_user_deactivated")}`;
    // Fallback: render key=value pairs
    return Object.entries(m)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(", ")
      .slice(0, 120);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <Head><title>{t("admin.title")} – SeMSe</title></Head>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
            <p className="text-muted-foreground">
              {t("admin.page_description")}
            </p>
            <p className="text-sm text-muted-foreground">
              Commit: <span className="font-mono">{appCommit}</span>
            </p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("admin.tabs.users")}
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("admin.groups_title")}
            </TabsTrigger>
            <TabsTrigger value="gateways" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t("admin.gateways_title")}
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center gap-2">
              <Router className="h-4 w-4" />
              {t("admin.tabs.routing")}
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t("admin.tabs.audit")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>{t("admin.users_title")}</CardTitle>
                  <CardDescription>
                    {t("admin.users_description")}
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("admin.new_user_btn")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle id="create-user-dialog-title">{t("admin.create_user_title")}</DialogTitle>
                      <DialogDescription>
                        {t("admin.create_user_description")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>{t("admin.name")}</Label>
                        <Input
                          value={newUser.full_name}
                          onChange={(e) =>
                            setNewUser({ ...newUser, full_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("admin.email")}</Label>
                        <Input
                          value={newUser.email}
                          onChange={(e) =>
                            setNewUser({ ...newUser, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("admin.password")}</Label>
                        <Input
                          type="password"
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser({ ...newUser, password: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("admin.phone")}</Label>
                        <Input
                          value={newUser.phone}
                          onChange={(e) =>
                            setNewUser({ ...newUser, phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("admin.role")}</Label>
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
                            <SelectItem value="member">{t("admin.member")}</SelectItem>
                            <SelectItem value="group_admin">{t("admin.group_admin")}</SelectItem>
                            <SelectItem value="tenant_admin">{t("admin.tenant_admin")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("admin.groups_label")}</Label>
                        <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                          {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("admin.no_groups_available")}</p>
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
                        <Label>{t("admin.groups_to_admin")}</Label>
                        <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto bg-muted/30">
                          {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("admin.no_groups_available")}</p>
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
                          {t("admin.select_admin_groups")}
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      {newUser.group_ids.length === 0 && (
                        <p className="text-sm text-destructive mr-auto">
                          ⚠️ {t("admin.select_at_least_one")}
                        </p>
                      )}
                      <Button
                        onClick={handleCreateUser}
                        disabled={newUser.group_ids.length === 0}
                      >
                        {t("admin.create_user_button")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
                  <DialogHeader className="flex-none">
                    <DialogTitle id="edit-user-dialog-title">{t("admin.edit_user_title")}</DialogTitle>
                    <DialogDescription>
                      {t("admin.edit_user_description")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>{t("admin.name")}</Label>
                      <Input
                        value={editUserData.full_name}
                        onChange={(e) =>
                          setEditUserData({ ...editUserData, full_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("admin.email")}</Label>
                      <Input
                        value={editUserData.email}
                        onChange={(e) =>
                          setEditUserData({ ...editUserData, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("admin.phone")}</Label>
                      <Input
                        value={editUserData.phone}
                        onChange={(e) =>
                          setEditUserData({ ...editUserData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("admin.role")}</Label>
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
                          <SelectItem value="member">{t("admin.member")}</SelectItem>
                          <SelectItem value="group_admin">{t("admin.group_admin")}</SelectItem>
                          <SelectItem value="tenant_admin">{t("admin.tenant_admin")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {editUserData.role === "group_admin" && (
                      <div className="grid gap-2">
                        <Label>{t("admin.groups_to_admin")}</Label>
                        <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto bg-muted/30">
                          {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("admin.no_groups_available")}</p>
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
                          {t("admin.select_admin_groups")}
                        </p>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label>{t("admin.groups_label")}</Label>
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
                  </div>{/* end scroll container */}
                  <DialogFooter className="flex-none pt-2 border-t">
                    <Button variant="outline" onClick={() => setEditingUser(null)}>
                      {t("admin.cancel")}
                    </Button>
                    <Button onClick={handleUpdateUser}>{t("admin.save_changes")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <CardContent>
                <div className="flex items-center py-4">
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("admin.search_users")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.name")}</TableHead>
                        <TableHead>{t("admin.email")}</TableHead>
                        <TableHead>{t("admin.role")}</TableHead>
                        <TableHead>{t("admin.groups_label")}</TableHead>
                        <TableHead>{t("admin.status")}</TableHead>
                        <TableHead className="text-right">{t("admin.actions")}</TableHead>
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
                              {user.deleted_at ? t("admin.inactive") : t("admin.active")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingUser(user)}
                                title={t("admin.edit_user_title")}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(user.id)}
                                title={t("admin.delete_user")}
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
                  <CardTitle>{t("admin.groups_title")}</CardTitle>
                  <CardDescription>
                    {t("admin.groups_description")}
                  </CardDescription>
                </div>
                <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
                  <Button onClick={() => setCreateGroupOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("admin.new_group_btn")}
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle id="create-group-dialog-title">{t("admin.create_group_title")}</DialogTitle>
                      <DialogDescription>
                        {t("admin.create_group_description")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>{t("admin.name")}</Label>
                        <Input
                          value={newGroup.name}
                          onChange={(e) =>
                            setNewGroup({ ...newGroup, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("admin.description_label")}</Label>
                        <Input
                          value={newGroup.description}
                          onChange={(e) =>
                            setNewGroup({ ...newGroup, description: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("admin.table.type")}</Label>
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
                            <SelectItem value="operational">{t("admin.kind.operational")}</SelectItem>
                            <SelectItem value="administrative">{t("admin.kind.administrative")}</SelectItem>
                            <SelectItem value="billing">{t("admin.kind.billing")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("admin.parent_group")}</Label>
                        <Select
                          value={newGroup.parent_id}
                          onValueChange={(value) =>
                            setNewGroup({ ...newGroup, parent_id: value, gateway_id: value === "none" ? newGroup.gateway_id : "" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("admin.select_parent")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("admin.no_parent")}</SelectItem>
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
                          <Label>{t("admin.gateway")} <span className="text-destructive">*</span></Label>
                          <Select
                            value={newGroup.gateway_id}
                            onValueChange={(value) =>
                              setNewGroup({ ...newGroup, gateway_id: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("admin.select_gateway")} />
                            </SelectTrigger>
                            <SelectContent>
                              {gateways.filter(gw => gw.is_active).map((gw) => (
                                <SelectItem key={gw.id} value={gw.id}>
                                  {gw.name} ({gw.gw_phone || t("admin.no_phone")})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {t("admin.root_needs_gateway")}
                          </p>
                        </div>
                      )}

                      <div className="grid gap-2">
                        <Label>{t("admin.min_active_members")}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newGroup.min_active}
                          onChange={(e) =>
                            setNewGroup({ ...newGroup, min_active: Math.max(0, parseInt(e.target.value) || 0) })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("admin.min_active_help")}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                        <Switch
                          checked={newGroup.escalation_enabled}
                          onCheckedChange={(checked) =>
                            setNewGroup({ ...newGroup, escalation_enabled: checked })
                          }
                        />
                        <Label>{t("admin.enable_escalation")}</Label>
                      </div>

                      {newGroup.escalation_enabled && (
                        <div className="grid gap-2">
                          <Label>{t("admin.timeout_minutes")}</Label>
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
                        {t("admin.create_group_button")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="border rounded-lg p-4 bg-muted/20">
                  <h3 className="font-semibold mb-3 text-sm">{t("admin.group_hierarchy")}</h3>
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
                  <h3 className="font-semibold mb-3">{t("admin.all_groups")}</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("admin.name")}</TableHead>
                          <TableHead>{t("admin.table.type")}</TableHead>
                          <TableHead>{t("admin.table.active_min")}</TableHead>
                          <TableHead>{t("admin.table.escalation")}</TableHead>
                          <TableHead className="text-right">{t("admin.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groups.map((group) => {
                          const active  = activeMembers[group.id] ?? 0;
                          const minAct  = (group as any).min_active ?? 0;
                          const atMin   = active <= minAct && minAct > 0;
                          return (
                          <TableRow key={group.id}>
                            <TableCell className="font-medium">{group.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{group.kind}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`text-sm flex items-center gap-1 ${atMin ? "text-orange-600 font-medium" : ""}`}>
                                {atMin && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                                {active} {t("admin.active").toLowerCase()} / min {minAct}
                              </span>
                            </TableCell>
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
                                  onClick={() =>
                                    setSelectedGroupId(
                                      selectedGroupId === group.id ? null : group.id
                                    )
                                  }
                                  title={t("admin.view_details")}
                                >
                                  {selectedGroupId === group.id ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingGroup(group)}
                                  title={t("admin.edit_group")}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteGroup(group.id)}
                                  title={t("admin.delete_group")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* ── Group detail panel ── */}
                {selectedGroupId && (() => {
                  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
                  if (!selectedGroup) return null;
                  return (
                    <div className="border rounded-lg p-4 bg-muted/10">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm">
                          {selectedGroup.name} — {t("admin.members")}
                        </h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setSelectedGroupId(null)}
                          title={t("admin.cancel")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <GroupDetailPanel
                        group={selectedGroup}
                        onRefresh={fetchData}
                      />
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle id="edit-group-dialog-title">{t("admin.edit_group")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.update_group_info")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>{t("admin.name")}</Label>
                    <Input
                      value={editGroupData.name}
                      onChange={(e) =>
                        setEditGroupData({ ...editGroupData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("admin.description_label")}</Label>
                    <Input
                      value={editGroupData.description}
                      onChange={(e) =>
                        setEditGroupData({ ...editGroupData, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("admin.table.type")}</Label>
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
                        <SelectItem value="operational">{t("admin.kind.operational")}</SelectItem>
                        <SelectItem value="administrative">{t("admin.kind.administrative")}</SelectItem>
                        <SelectItem value="billing">{t("admin.kind.billing")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("admin.parent_group")}</Label>
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
                        <SelectItem value="none">{t("admin.no_parent")}</SelectItem>
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
                      <Label>{t("admin.gateway")}</Label>
                      <Select
                        value={editGroupData.gateway_id}
                        onValueChange={(value) =>
                          setEditGroupData({ ...editGroupData, gateway_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("admin.select_gateway")} />
                        </SelectTrigger>
                        <SelectContent>
                          {gateways.filter(gw => gw.is_active).map((gw) => (
                            <SelectItem key={gw.id} value={gw.id}>
                              {gw.name} ({gw.gw_phone || t("admin.no_phone")})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>{t("admin.min_active_members")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editGroupData.min_active}
                      onChange={(e) =>
                        setEditGroupData({
                          ...editGroupData,
                          min_active: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                    />
                    {editingGroup && (() => {
                      const active = activeMembers[editingGroup.id] ?? 0;
                      const atMin  = active <= editGroupData.min_active && editGroupData.min_active > 0;
                      return (
                        <p className={`text-xs flex items-center gap-1 ${atMin ? "text-orange-600" : "text-muted-foreground"}`}>
                          {atMin && <AlertTriangle className="h-3 w-3 shrink-0" />}
                          {active} {t("admin.active_currently")}
                        </p>
                      );
                    })()}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={editGroupData.escalation_enabled}
                      onCheckedChange={(checked) =>
                        setEditGroupData({ ...editGroupData, escalation_enabled: checked })
                      }
                    />
                    <Label>{t("admin.enable_escalation")}</Label>
                  </div>

                  {editGroupData.escalation_enabled && (
                    <div className="grid gap-2">
                      <Label>{t("admin.timeout_minutes")}</Label>
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
                    {t("admin.cancel")}
                  </Button>
                  <Button onClick={handleUpdateGroup}>{t("admin.save_changes")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="gateways" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.gateways_title")}</CardTitle>
                <CardDescription>{t("admin.gateways_description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 border p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("admin.gateway_name")}</Label>
                      <Input
                        placeholder="Helse Gateway"
                        value={newGateway.name}
                        onChange={(e) => setNewGateway({...newGateway, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.phone_number")}</Label>
                      <Input 
                        placeholder="+47..."
                        value={newGateway.gw_phone}
                        onChange={(e) => setNewGateway({...newGateway, gw_phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.base_url")}</Label>
                      <Input 
                        placeholder="https://semse.iotcrafts.in/"
                        value={newGateway.base_url}
                        onChange={(e) => setNewGateway({...newGateway, base_url: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.api_key")}</Label>
                      <Input
                        type="password"
                        placeholder={t("admin.api_key_placeholder")}
                        value={newGateway.api_key}
                        onChange={(e) => setNewGateway({...newGateway, api_key: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gateway_description">{t("admin.description_label")}</Label>
                      <Input
                        id="gateway_description"
                        placeholder={t("admin.gateway_desc_placeholder")}
                        value={newGateway.gateway_description}
                        onChange={(e) =>
                          setNewGateway({ ...newGateway, gateway_description: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhook_secret">{t("admin.webhook_secret")}</Label>
                      <Input
                        id="webhook_secret"
                        type="password"
                        placeholder={t("admin.optional")}
                        value={newGateway.webhook_secret}
                        onChange={(e) =>
                          setNewGateway({ ...newGateway, webhook_secret: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button onClick={() => handleCreateGateway(newGateway)} size="sm" className="w-full mt-4">
                    <Plus className="mr-2 h-4 w-4" /> {t("admin.add_gateway")}
                  </Button>
                </div>

                <div className="space-y-2 mt-4">
                  {gateways.length === 0 ? (
                    <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                      {t("admin.no_gateways")}
                    </div>
                  ) : (
                    gateways.map(gw => (
                      <div key={gw.id} className="flex items-center justify-between p-3 border rounded bg-secondary/10">
                        <div>
                          <div className="font-medium">{gw.name}</div>
                          <div className="text-sm text-muted-foreground">{gw.base_url}</div>
                          <div className="text-xs text-muted-foreground">{gw.gw_phone || t("admin.no_phone")}</div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Badge variant={gw.is_active ? 'default' : 'secondary'}>
                            {gw.is_active ? t("admin.active") : t("admin.inactive")}
                          </Badge>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditGateway(gw)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
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

            {/* ── Edit gateway dialog ─────────────────────────────────────── */}
            <Dialog open={!!editingGateway} onOpenChange={(open) => { if (!open) setEditingGateway(null); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rediger gateway</DialogTitle>
                  <DialogDescription>Oppdater gatewayens innstillinger</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Gateway-navn</Label>
                    <Input value={editGatewayData.name} onChange={(e) => setEditGatewayData({ ...editGatewayData, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.phone_number")}</Label>
                    <Input value={editGatewayData.gw_phone} onChange={(e) => setEditGatewayData({ ...editGatewayData, gw_phone: e.target.value })} placeholder="+47..." />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.base_url")}</Label>
                    <Input value={editGatewayData.base_url} onChange={(e) => setEditGatewayData({ ...editGatewayData, base_url: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.api_key")}</Label>
                    <Input value={editGatewayData.api_key} onChange={(e) => setEditGatewayData({ ...editGatewayData, api_key: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.api_secret")}</Label>
                    <Input type="password" value={editGatewayData.api_secret} onChange={(e) => setEditGatewayData({ ...editGatewayData, api_secret: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.webhook_secret")}</Label>
                    <Input type="password" value={editGatewayData.webhook_secret} onChange={(e) => setEditGatewayData({ ...editGatewayData, webhook_secret: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.description")}</Label>
                    <Input value={editGatewayData.gateway_description} onChange={(e) => setEditGatewayData({ ...editGatewayData, gateway_description: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingGateway(null)}>{t("admin.cancel")}</Button>
                  <Button onClick={handleSaveGateway}>{t("admin.save_changes")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.routing_rules_title")}</CardTitle>
                <CardDescription>
                  {t("admin.routing_description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gateways.length === 0 ? (
                  <div className="text-center p-8 border rounded-lg border-dashed">
                    <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">{t("admin.no_gateways_found")}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("admin.routing_no_gateways_help")}
                    </p>
                    <Button variant="outline" onClick={() => {
                      const tabsList = document.querySelector('[role="tablist"]');
                      const gatewaysTab = tabsList?.querySelector('[value="gateways"]') as HTMLElement;
                      gatewaysTab?.click();
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("admin.go_to_gateways")}
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
                <CardTitle>{t("admin.audit_log_title")}</CardTitle>
                <CardDescription>{t("admin.audit_description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ── Filters ── */}
                <div className="flex flex-wrap gap-3 items-end border rounded-md p-3 bg-muted/20">
                  <Filter className="h-4 w-4 text-muted-foreground mt-auto mb-0.5 shrink-0" />
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("admin.event_type")}</label>
                    <Select
                      value={auditFilter.event_type || "__all__"}
                      onValueChange={(v) =>
                        setAuditFilter({ ...auditFilter, event_type: v === "__all__" ? "" : v })
                      }
                    >
                      <SelectTrigger className="h-8 w-48 text-sm">
                        <SelectValue placeholder={t("admin.all_types")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("admin.all_types")}</SelectItem>
                        {[
                          "activated","deactivated","activation_requested","activation_confirmed",
                          "activation_rejected","activation_expired","admin_override",
                          "min_active_changed","rule_changed","rule_matched",
                        ].map((et) => (
                          <SelectItem key={et} value={et}>{et}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("admin.group_label")}</label>
                    <Select
                      value={auditFilter.group_id || "__all__"}
                      onValueChange={(v) =>
                        setAuditFilter({ ...auditFilter, group_id: v === "__all__" ? "" : v })
                      }
                    >
                      <SelectTrigger className="h-8 w-44 text-sm">
                        <SelectValue placeholder={t("admin.all_groups_filter")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("admin.all_groups_filter")}</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("admin.user_label")}</label>
                    <Select
                      value={auditFilter.user_id || "__all__"}
                      onValueChange={(v) =>
                        setAuditFilter({ ...auditFilter, user_id: v === "__all__" ? "" : v })
                      }
                    >
                      <SelectTrigger className="h-8 w-44 text-sm">
                        <SelectValue placeholder={t("admin.all_users")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("admin.all_users")}</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(auditFilter.event_type || auditFilter.group_id || auditFilter.user_id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setAuditFilter({ group_id: "", user_id: "", event_type: "" })}
                    >
                      {t("admin.reset_filter")}
                    </Button>
                  )}
                </div>

                {/* ── Log table ── */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">{t("admin.timestamp")}</TableHead>
                      <TableHead>{t("admin.actor")}</TableHead>
                      <TableHead>{t("admin.event")}</TableHead>
                      <TableHead>{t("admin.group_label")}</TableHead>
                      <TableHead>{t("admin.target")}</TableHead>
                      <TableHead>{t("admin.details")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs
                      .filter((log) => {
                        if (auditFilter.event_type && log.event_type !== auditFilter.event_type) return false;
                        if (auditFilter.group_id   && log.group_id   !== auditFilter.group_id)   return false;
                        if (auditFilter.user_id    && log.user_id    !== auditFilter.user_id)     return false;
                        return true;
                      })
                      .map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("nb-NO", {
                              day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {(log as any).actor_name || t("admin.system")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.event_type || log.action || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(log as any).group_name || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(log as any).target_name || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs">
                            {formatAuditMetadata(log)}
                          </TableCell>
                        </TableRow>
                      ))}
                    {auditLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {t("admin.no_audit_entries")}
                        </TableCell>
                      </TableRow>
                    )}
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
