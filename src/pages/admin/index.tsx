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
import { groupService, type GroupNode } from "@/services/groupService";
import { userService } from "@/services/userService";
import { gatewayService } from "@/services/gatewayService";
import { routingRuleService } from "@/services/routingRuleService";
import { contactService } from "@/services/contactService";
import { auditService, type AuditLogEntry } from "@/services/auditService";
import { 
  Users, 
  Settings, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  X,
  ChevronDown,
  ChevronRight,
  Shield,
  Radio,
  MessageSquare,
  UserCheck,
  AlertTriangle,
  UserCog,
  Edit2,
  Wifi,
  Star,
  GitBranch,
  Phone,
  Clock
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageProvider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Group extends GroupNode {
  children?: Group[];
}

type User = Database["public"]["Tables"]["users"]["Row"] & {
  groups?: string[];
  group_memberships?: { groups: { id: string; name: string } | null }[];
  phone?: string;
  phone_number?: string;
  on_duty?: boolean;
  group_ids?: string[];
};

interface Gateway {
  id: string;
  name: string;
  base_url: string;
  api_key: string | null;
  status: string;
  is_default: boolean;
  tenant_id: string;
  created_at: string;
  phone_number: string;
}

interface RoutingRule {
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
}

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  groups: { id: string; name: string }[];
}

export default function AdminPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"groups" | "users" | "gateways">("groups");
  const [loading, setLoading] = useState(true);
  
  const [groups, setGroups] = useState<GroupNode[]>([]);
  const [allGroups, setAllGroups] = useState<GroupNode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [realUser, setRealUser] = useState<User | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showEditGroupDialog, setShowEditGroupDialog] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showCreateGatewayDialog, setShowCreateGatewayDialog] = useState(false);
  const [showEditGatewayDialog, setShowEditGatewayDialog] = useState(false);
  const [showCreateRoutingRuleDialog, setShowCreateRoutingRuleDialog] = useState(false);
  const [showAuditDialog, setShowAuditDialog] = useState(false);

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupNode | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editGateway, setEditGateway] = useState<Gateway | null>(null);
  
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [groupContacts, setGroupContacts] = useState<Contact[]>([]);

  const [newGroup, setNewGroup] = useState({
    name: "",
    kind: "operational" as "structural" | "operational",
    parent_id: null as string | null,
    description: "",
    gateway_id: null as string | null,
    escalation_enabled: false,
    escalation_timeout_minutes: "" as string
  });

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    role: "operator" as "tenant_admin" | "group_admin" | "operator",
    password: "",
    groupIds: [] as string[],
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

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [groupsRes, usersRes, gatewaysRes] = await Promise.all([
        supabase.from("groups").select("*").order("name"),
        supabase
          .from("users")
          .select(`
            *,
            group_memberships(
              groups(id, name)
            )
          `)
          .order("name"),
        supabase.from("gateways").select("*").order("name")
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (gatewaysRes.error) throw gatewaysRes.error;

      setGroups(groupsRes.data || []);
      setGateways(gatewaysRes.data || []);

      const usersWithGroups = (usersRes.data || []).map((user: any) => ({
        ...user,
        groups: user.group_memberships
          ?.map((gm: any) => gm.groups?.name)
          .filter(Boolean) || []
      }));

      setUsers(usersWithGroups);
    } catch (error: any) {
      toast({ title: "Feil ved lasting av data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne brukeren?")) return;
    
    try {
      setCreating(true);
      await userService.deleteUser(userId);
      await loadData();
      toast({ title: "Bruker slettet" });
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast({ title: "Feil ved sletting", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
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

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroup.name || !currentUser?.tenant_id) return;

    try {
      setCreating(true);
      await groupService.createGroup({
        name: newGroup.name,
        kind: newGroup.kind,
        description: newGroup.description,
        parent_id: newGroup.parent_id || null,
        gateway_id: newGroup.gateway_id || null,
        tenant_id: currentUser.tenant_id,
        escalation_enabled: newGroup.escalation_enabled,
        escalation_timeout_minutes: newGroup.escalation_timeout_minutes ? parseInt(newGroup.escalation_timeout_minutes) : undefined,
      });
      setNewGroup({
        name: "",
        kind: "operational",
        parent_id: null,
        description: "",
        gateway_id: null,
        escalation_enabled: false,
        escalation_timeout_minutes: ""
      });
      setShowCreateDialog(false);
      await loadData();
      toast({ title: "Gruppe opprettet" });
    } catch (error: any) {
      console.error("Failed to create group:", error);
      toast({ title: "Feil ved opprettelse", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleEditGroup = (group: GroupNode) => {
    const groupForEdit: Group = {
      id: group.id,
      name: group.name,
      parent_group_id: group.parent_group_id || null,
      parent_id: group.parent_id || null,
      total_members: group.total_members || 0,
      kind: group.kind || "operational",
      description: group.description || null,
      gateway_id: group.gateway_id || null
    };
    setEditingGroup(groupForEdit);
    setShowGroupDetails(false);
    setShowEditGroupDialog(true);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;
    
    try {
      setCreating(true);

      const updates: {
        name?: string;
        description?: string | null;
        gateway_id?: string | null;
      } = {};

      const originalGroup = groups.find(g => g.id === editingGroup.id);

      if (editingGroup.name !== originalGroup?.name) {
        updates.name = editingGroup.name;
      }
      if (editingGroup.description !== originalGroup?.description) {
        updates.description = editingGroup.description || null;
      }
      if (editingGroup.gateway_id !== originalGroup?.gateway_id) {
        updates.gateway_id = editingGroup.gateway_id || null;
      }

      if (Object.keys(updates).length === 0) {
        toast({ title: "Ingen endringer å lagre" });
        setShowEditGroupDialog(false);
        setEditingGroup(null);
        return;
      }

      await groupService.updateGroup(editingGroup.id, updates);

      toast({ title: "Gruppe oppdatert" });
      
      setShowEditGroupDialog(false);
      setEditingGroup(null);
      
      await loadData();
    } catch (error: any) {
      console.error("Error updating group:", error);
      toast({ title: "Feil ved oppdatering", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.name || !newUser.email || !newUser.password) {
        toast({
          title: t("common.error"),
          description: t("admin.fill_required_fields"),
          variant: "destructive",
        });
        return;
      }

      setCreating(true);

      const user = await userService.createUser({
        email: newUser.email,
        password: newUser.password,
        name: newUser.name,
        role: (newUser.role === "operator" ? "member" : newUser.role) as "tenant_admin" | "group_admin" | "member",
        phone: newUser.phone || "",
      });

      // Add user to selected groups
      if (newUser.groupIds.length > 0 && user) {
        const { error: membershipError } = await supabase
          .from("group_memberships")
          .insert(
            newUser.groupIds.map((groupId) => ({
              user_id: user.id,
              group_id: groupId,
            }))
          );

        if (membershipError) {
          console.error("Failed to add group memberships:", membershipError);
        }
      }

      toast({
        title: t("common.success"),
        description: t("admin.user_created"),
      });

      setShowCreateDialog(false);
      setNewUser({
        name: "",
        email: "",
        phone: "",
        role: "operator",
        password: "",
        groupIds: [],
      });
      loadData();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditUser = (user: User) => {
    const userToEdit = {
      ...user,
      group_ids: user.group_ids || []
    };
    setEditUser(userToEdit);
    setShowEditUserDialog(true);
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;
    
    try {
      setCreating(true);

      if (!editUser.name || !editUser.email) {
        toast({ title: "Mangler info", description: "Navn og e-post må fylles ut", variant: "destructive" });
        return;
      }

      await userService.updateUser(editUser.id, {
        name: editUser.name,
        email: editUser.email,
        phone: (editUser as any).phone_number || editUser.phone || "",
        role: editUser.role as any,
        group_ids: editUser.group_ids || [],
        status: editUser.status
      });

      setEditUser(null);
      setShowEditUserDialog(false);
      toast({ title: "Bruker oppdatert" });
      await loadData();
    } catch (error: any) {
      console.error("Failed to update user:", error);
      toast({ title: "Feil ved oppdatering", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateGateway = async () => {
    try {
      setCreating(true);

      console.log("=== Gateway Creation Debug ===");
      console.log("1. Current user:", currentUser);
      console.log("2. Tenant ID:", currentUser?.tenant_id);
      console.log("3. New gateway data:", newGateway);

      if (!newGateway.name.trim() || !newGateway.base_url.trim()) {
        toast({ title: "Mangler info", description: "Navn og URL må fylles ut", variant: "destructive" });
        return;
      }

      if (!newGateway.phone_number.trim()) {
        toast({ title: "Mangler info", description: "Telefonnummer må fylles ut", variant: "destructive" });
        return;
      }

      if (!currentUser?.tenant_id) {
        console.error("4. ERROR: Missing tenant_id. Current user:", currentUser);
        toast({ title: "Feil", description: "Mangler tenant ID. Prøv å laste siden på nytt.", variant: "destructive" });
        return;
      }

      const gatewayData = {
        name: newGateway.name.trim(),
        base_url: newGateway.base_url.trim(),
        api_key: newGateway.api_key.trim() || null,
        status: newGateway.is_active ? 'active' : 'inactive',
        is_default: newGateway.is_default,
        phone_number: newGateway.phone_number.trim(),
        tenant_id: currentUser.tenant_id,
      };

      console.log("5. Calling gatewayService.createGateway with:", gatewayData);

      const result = await gatewayService.createGateway(gatewayData);

      console.log("6. Gateway created successfully:", result);

      setNewGateway({
        name: "",
        base_url: "",
        api_key: "",
        is_active: true,
        is_default: false,
        phone_number: "",
      });
      setShowCreateGatewayDialog(false);
      toast({ title: "Gateway opprettet" });
      await loadData();
    } catch (error: any) {
      console.error("7. Failed to create gateway:", error);
      console.error("8. Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      toast({ 
        title: "Feil ved opprettelse", 
        description: error.message || "Kunne ikke opprette gateway", 
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEditGateway = (gateway: Gateway) => {
    setEditGateway(gateway);
    setShowEditGatewayDialog(true);
  };

  const handleUpdateGateway = async () => {
    if (!editGateway) return;
    
    try {
      setCreating(true);

      if (!editGateway.name.trim() || !editGateway.base_url.trim()) {
        toast({ title: "Mangler info", description: "Navn og URL må fylles ut", variant: "destructive" });
        return;
      }

      if (!editGateway.phone_number.trim()) {
        toast({ title: "Mangler info", description: "Telefonnummer må fylles ut", variant: "destructive" });
        return;
      }

      await gatewayService.updateGateway(editGateway.id, {
        name: editGateway.name.trim(),
        base_url: editGateway.base_url.trim(),
        api_key: editGateway.api_key?.trim() || null,
        status: editGateway.status,
        is_default: editGateway.is_default,
        phone_number: editGateway.phone_number.trim(),
      });

      setEditGateway(null);
      setShowEditGatewayDialog(false);
      toast({ title: "Gateway oppdatert" });
      await loadData();
    } catch (error: any) {
      console.error("Failed to update gateway:", error);
      toast({ 
        title: "Feil ved oppdatering", 
        description: error.message || "Kunne ikke oppdatere gateway", 
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateRoutingRule = async () => {
    try {
      setCreating(true);

      if (!newRoutingRule.gateway_id || !newRoutingRule.target_group_id) {
        toast({ title: "Mangler info", description: "Velg gateway og målgruppe", variant: "destructive" });
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
      toast({ title: "Routing rule opprettet" });
      await loadData();
    } catch (error: any) {
      console.error("Failed to create routing rule:", error);
      toast({ title: "Feil ved opprettelse", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoutingRule = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne routing rule?")) return;
    
    try {
      await routingRuleService.deleteRoutingRule(id);
      await loadData();
      toast({ title: "Routing rule slettet" });
    } catch (error: any) {
      console.error("Failed to delete routing rule:", error);
      toast({ title: "Feil ved sletting", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne gruppen? Dette kan ikke angres.")) return;
    
    try {
      await groupService.deleteGroup(groupId);
      await loadData();
      toast({ title: "Gruppe slettet" });
    } catch (error: any) {
      console.error("Failed to delete group:", error);
      toast({ title: "Feil ved sletting", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleRoutingRule = async (id: string, isActive: boolean) => {
    try {
      await routingRuleService.toggleRoutingRule(id, isActive);
      await loadData();
    } catch (error: any) {
      console.error("Failed to toggle routing rule:", error);
      toast({ title: "Feil ved oppdatering", description: error.message, variant: "destructive" });
    }
  };

  const handleSetDefaultGateway = async (gatewayId: string) => {
    if (!currentUser?.tenant_id) return;
    
    try {
      await gatewayService.setDefaultGateway(gatewayId, currentUser.tenant_id);
      await loadData();
      toast({ title: "Standard gateway oppdatert" });
    } catch (error: any) {
      console.error("Failed to set default gateway:", error);
      toast({ title: "Feil ved oppdatering", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGateway = async (gatewayId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne gatewayen?")) return;
    
    try {
      await gatewayService.deleteGateway(gatewayId);
      await loadData();
      toast({ title: "Gateway slettet" });
    } catch (error: any) {
      console.error("Failed to delete gateway:", error);
      toast({ title: "Feil ved sletting", description: error.message, variant: "destructive" });
    }
  };

  const toggleUserGroupSelection = (groupId: string) => {
    setNewUser((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId],
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

  const renderGroupHierarchy = () => {
    if (groups.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="text-center text-gray-500 py-8">
            {t("admin.no_groups")}
          </TableCell>
        </TableRow>
      );
    }

    const rows: JSX.Element[] = [];
    
    const buildTree = (groups: GroupNode[]): Group[] => {
      const groupMap = new Map<string, Group>();
      
      groups.forEach(group => {
        const uiGroup: Group = {
          ...group,
          children: []
        };
        groupMap.set(group.id, uiGroup);
      });

      const rootGroups: Group[] = [];

      groups.forEach(group => {
        const node = groupMap.get(group.id)!;
        const parentId = group.parent_id || group.parent_group_id;
        
        if (parentId) {
          const parent = groupMap.get(parentId);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(node);
          } else {
            rootGroups.push(node);
          }
        } else {
          rootGroups.push(node);
        }
      });

      return rootGroups;
    };

    const renderGroup = (group: Group, level: number = 0, isLast: boolean = false, parentPrefix: string = "") => {
      const hasChildren = group.children && group.children.length > 0;
      
      const connector = isLast ? "└──" : "├──";
      const linePrefix = level > 0 ? parentPrefix + connector + " " : "";

      rows.push(
        <TableRow key={group.id} className="hover:bg-accent/50">
          <TableCell>
            <div className="flex items-center gap-2">
              {level > 0 && (
                <span className="text-muted-foreground font-mono text-sm whitespace-pre">
                  {linePrefix}
                </span>
              )}
              <span className="font-medium">{group.name}</span>
              <Badge variant={group.kind === "operational" ? "default" : "secondary"} className="text-xs">
                {group.kind === "operational" ? "Op" : "Str"}
              </Badge>
            </div>
          </TableCell>
          <TableCell>
            {group.gateway_name ? (
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-green-600" />
                <span className="text-sm">{group.gateway_name}</span>
                {group.is_gateway_inherited && (
                  <Badge variant="outline" className="text-xs">Arvet</Badge>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Ingen gateway</span>
            )}
          </TableCell>
          <TableCell className="text-center">
            <span className="font-medium">{group.active_members || 0}</span>
          </TableCell>
          <TableCell className="text-center">
            <span className="font-medium">{group.total_members || 0}</span>
          </TableCell>
          <TableCell>
            {group.parent_name ? (
              <span className="text-sm text-muted-foreground">{group.parent_name}</span>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </TableCell>
          <TableCell>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelectGroup(group)}
              >
                Vis detaljer
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEditGroup(group)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Rediger
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteGroup(group.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Slett
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TableCell>
        </TableRow>
      );

      if (hasChildren) {
        const newPrefix = level > 0 ? parentPrefix + (isLast ? "    " : "│   ") : "";
        group.children!.forEach((child, index) => {
          const isLastChild = index === group.children!.length - 1;
          renderGroup(child, level + 1, isLastChild, newPrefix);
        });
      }
    };

    const tree = buildTree(groups);
    tree.forEach((group, index) => {
      const isLast = index === tree.length - 1;
      renderGroup(group, 0, isLast);
    });
    
    return rows;
  };

  return (
    <>
      <Head>
        <title>{t("admin.title")} | SeMSe</title>
        <meta name="description" content={t("admin.description")} />
      </Head>

      <AppLayout>
        <div className="space-y-6">
          {isDemoMode && (
            <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900 dark:text-amber-100">{t("admin.demo_mode")}</AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {t("admin.demo_description")} <strong>{currentUser?.name}</strong> ({getRoleLabel(currentUser?.role || "")}).
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-4 border-amber-600 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/30"
                  onClick={handleExitDemoMode}
                >
                  {t("admin.exit_demo")} {realUser?.name}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("admin.title")}</h2>
              <p className="text-muted-foreground mt-2">
                {t("admin.description")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Card className="p-3">
                <div className="flex items-center gap-3">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("admin.active_user")}</Label>
                    <Select value={currentUser?.id} onValueChange={handleSwitchUser}>
                      <SelectTrigger className="w-[280px] h-9">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{currentUser?.name}</span>
                              <span className="text-xs text-muted-foreground">{currentUser?.email}</span>
                            </div>
                            <Badge variant={getRoleBadgeVariant(currentUser?.role || "")} className="text-xs ml-auto">
                              {getRoleLabel(currentUser?.role || "")}
                            </Badge>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{user.name}</span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                              </div>
                              <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs ml-2">
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

              <Button
                onClick={() => {
                  setNewGroup({
                    name: "",
                    kind: "operational",
                    parent_id: null,
                    description: "",
                    gateway_id: null,
                    escalation_enabled: false,
                    escalation_timeout_minutes: ""
                  });
                  setShowCreateDialog(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("admin.create_group")}
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab("groups")}
                  className={cn(
                    "pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === "groups"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  {t("admin.tabs.groups")}
                </button>
                <button
                  onClick={() => setActiveTab("users")}
                  className={cn(
                    "pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === "users"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t("admin.tabs.users")}
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("gateways")}
                  className={cn(
                    "pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === "gateways"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4" />
                    {t("admin.tabs.gateways")}
                  </div>
                </button>
              </div>
            </div>

            <TabsContent value="groups" className="space-y-4">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">{t("admin.group_name")}</TableHead>
                      <TableHead className="w-[20%]">Gateway</TableHead>
                      <TableHead className="text-center w-[10%]">{t("admin.on_duty")}</TableHead>
                      <TableHead className="text-center w-[10%]">{t("admin.total")}</TableHead>
                      <TableHead className="w-[15%]">{t("admin.parent")}</TableHead>
                      <TableHead className="text-right w-[15%]">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renderGroupHierarchy()}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{t("admin.tabs.users")}</h2>
                <Button
                  onClick={() => {
                    setNewUser({
                      name: "",
                      email: "",
                      phone: "",
                      role: "operator",
                      password: "",
                      groupIds: []
                    });
                    setShowCreateUserDialog(true);
                  }}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("admin.new_user")}
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                      <TableHead>Navn</TableHead>
                      <TableHead>E-post</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Grupper</TableHead>
                      <TableHead>På vakt</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          {t("common.loading")}
                        </TableCell>
                      </TableRow>
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Ingen brukere funnet
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone_number || "-"}</TableCell>
                          <TableCell>
                            {user.groups && user.groups.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.groups.map((g: any, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {typeof g === 'string' ? g : g.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch 
                                checked={user.on_duty || false} 
                                onCheckedChange={async (checked) => {
                                  setUsers(users.map(u => u.id === user.id ? { ...u, on_duty: checked } : u));
                                  try {
                                    await userService.updateUser(user.id, { on_duty: checked });
                                    toast({ title: checked ? "Satt på vakt" : "Fjernet fra vakt" });
                                  } catch (error) {
                                    console.error("Failed to update on_duty status", error);
                                    toast({ title: "Kunne ikke oppdatere status", variant: "destructive" });
                                    setUsers(users.map(u => u.id === user.id ? { ...u, on_duty: !checked } : u));
                                  }
                                }}
                              />
                              <span className="text-sm text-muted-foreground">
                                {user.on_duty ? "På" : "Av"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditGateway(gateway)}
                                  >
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
          </Tabs>
        </div>
      </AppLayout>

      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setNewGroup({
            name: "",
            kind: "operational",
            parent_id: null,
            description: "",
            gateway_id: null,
            escalation_enabled: false,
            escalation_timeout_minutes: ""
          });
        }
      }}>
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
              <Label htmlFor="group-gateway">Gateway (valgfri)</Label>
              <Select value={newGroup.gateway_id || undefined} onValueChange={(value) => setNewGroup({ ...newGroup, gateway_id: value === "none" ? null : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg gateway (arver fra parent hvis tom)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen (arver fra parent)</SelectItem>
                  {gateways.map((gw) => (
                    <SelectItem key={gw.id} value={gw.id}>
                      {gw.name} ({gw.phone_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Velg gateway for denne gruppen. Undergrupper arver gateway hvis ikke satt.
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

      <Dialog open={showEditGroupDialog} onOpenChange={(open) => {
        setShowEditGroupDialog(open);
        if (!open) {
          setEditingGroup(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger gruppe</DialogTitle>
            <DialogDescription>
              Oppdater gruppeinformasjon og innstillinger.
            </DialogDescription>
          </DialogHeader>
          {editingGroup && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-group-name">Gruppenavn *</Label>
                <Input
                  id="edit-group-name"
                  placeholder="Fullt navn"
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-group-kind">Type</Label>
                <Badge variant={editingGroup.kind === "operational" ? "default" : "secondary"} className="text-xs">
                  {editingGroup.kind === "operational" ? "Operasjonell" : "Strukturell"}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Type kan ikke endres etter opprettelse
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-group-gateway">Gateway</Label>
                <Select value={editingGroup.gateway_id || undefined} onValueChange={(value) => setEditingGroup({ ...editingGroup, gateway_id: value || null })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg gateway (arver fra parent hvis tom)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen (arver fra parent)</SelectItem>
                    {gateways.map((gw) => (
                      <SelectItem key={gw.id} value={gw.id}>
                        {gw.name} ({gw.phone_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Velg gateway for denne gruppen. Undergrupper arver gateway hvis ikke satt.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-group-description">Beskrivelse (valgfri)</Label>
                <Textarea
                  id="edit-group-description"
                  placeholder="Kort beskrivelse av gruppens formål..."
                  value={editingGroup.description || ""}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditGroupDialog(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleUpdateGroup} disabled={creating}>
              {creating ? "Oppdaterer..." : "Lagre endringer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateUserDialog} onOpenChange={(open) => {
        setShowCreateUserDialog(open);
        if (!open) {
          setNewUser({
            name: "",
            email: "",
            phone: "",
            role: "operator",
            password: "",
            groupIds: []
          });
        }
      }}>
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
                <Label htmlFor="role">{t("admin.role")} *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) =>
                    setNewUser({ ...newUser, role: value as typeof newUser.role })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant_admin">
                      {t("admin.tenant_admin")}
                    </SelectItem>
                    <SelectItem value="group_admin">
                      {t("admin.group_admin")}
                    </SelectItem>
                    <SelectItem value="operator">
                      {t("admin.operator")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password">Passord *</Label>
              <Input
                id="user-password"
                type="password"
                placeholder="Skriv inn passord"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.group_membership")}</Label>
              <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("admin.no_operational_groups")}
                  </p>
                ) : (
                  groups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent p-1 rounded">
                      <input
                        type="checkbox"
                        id={`group-${group.id}`}
                        checked={newUser.groupIds.includes(group.id)}
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

      <Dialog open={showEditUserDialog} onOpenChange={(open) => {
        setShowEditUserDialog(open);
        if (!open) {
          setEditUser(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rediger bruker</DialogTitle>
            <DialogDescription>
              Oppdater brukerinformasjon og gruppetilhørighet.
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-user-name">Navn *</Label>
                  <Input
                    id="edit-user-name"
                    placeholder="Fullt navn"
                    value={editUser.name}
                    onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-email">E-post *</Label>
                  <Input
                    id="edit-user-email"
                    type="email"
                    placeholder="user@example.com"
                    value={editUser.email || ""}
                    onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-user-phone">Telefon</Label>
                  <Input
                    id="edit-user-phone"
                    placeholder="+47..."
                    value={(editUser as any).phone_number || ""}
                    onChange={(e) => setEditUser({ ...editUser, phone_number: e.target.value } as any)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-role">Rolle *</Label>
                  <select
                    id="edit-user-role"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={editUser.role}
                    onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  >
                    <option value="member">Medlem</option>
                    <option value="group_admin">Gruppe-admin</option>
                    <option value="tenant_admin">Tenant-admin</option>
                  </select>
                </div>
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
                            checked={editUser.group_ids?.includes(group.id) || false}
                            onChange={() => {
                              const currentGroupIds = editUser.group_ids || [];
                              const newGroupIds = currentGroupIds.includes(group.id)
                                ? currentGroupIds.filter(id => id !== group.id)
                                : [...currentGroupIds, group.id];
                              setEditUser({ ...editUser, group_ids: newGroupIds });
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm font-medium">{group.name}</span>
                        </label>
                      ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-user-status">Status</Label>
                <select
                  id="edit-user-status"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={editUser.status}
                  onChange={(e) => setEditUser({ ...editUser, status: e.target.value })}
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUserDialog(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleUpdateUser} disabled={creating}>
              {creating ? "Oppdaterer..." : "Lagre endringer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateGatewayDialog} onOpenChange={(open) => {
        setShowCreateGatewayDialog(open);
        if (!open) {
          setNewGateway({
            name: "",
            base_url: "",
            api_key: "",
            is_active: true,
            is_default: false,
            phone_number: "",
          });
        }
      }}>
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

      <Dialog open={showEditGatewayDialog} onOpenChange={(open) => {
        setShowEditGatewayDialog(open);
        if (!open) {
          setEditGateway(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rediger gateway</DialogTitle>
            <DialogDescription>
              Oppdater gateway-konfigurasjonen.
            </DialogDescription>
          </DialogHeader>
          {editGateway && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-gateway-name">Navn *</Label>
                <Input
                  id="edit-gateway-name"
                  placeholder="F.eks. FairGateway Produksjon"
                  value={editGateway.name}
                  onChange={(e) => setEditGateway({ ...editGateway, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-gateway-phone">Telefonnummer *</Label>
                <Input
                  id="edit-gateway-phone"
                  placeholder="+47..."
                  value={editGateway.phone_number}
                  onChange={(e) => setEditGateway({ ...editGateway, phone_number: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Telefonnummeret tilknyttet denne gatewayen
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-gateway-url">Base URL *</Label>
                <Input
                  id="edit-gateway-url"
                  placeholder="https://gateway.example.com"
                  value={editGateway.base_url}
                  onChange={(e) => setEditGateway({ ...editGateway, base_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  URL til FairGateway API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-gateway-api-key">API-nøkkel (valgfri)</Label>
                <Input
                  id="edit-gateway-api-key"
                  type="password"
                  placeholder="La stå tom for å beholde eksisterende"
                  value={editGateway.api_key || ""}
                  onChange={(e) => setEditGateway({ ...editGateway, api_key: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  API-nøkkel brukes for sikker autentisering
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-gateway-active">Gateway status</Label>
                    <p className="text-xs text-muted-foreground">
                      Kun aktive gateways brukes for sending
                    </p>
                  </div>
                  <Switch
                    id="edit-gateway-active"
                    checked={editGateway.status === 'active'}
                    onCheckedChange={(checked) => setEditGateway({ 
                      ...editGateway, 
                      status: checked ? "active" : "inactive" 
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-gateway-default">Standard gateway</Label>
                    <p className="text-xs text-muted-foreground">
                      Brukes når ingen spesifikk gateway er valgt
                    </p>
                  </div>
                  <Switch
                    id="edit-gateway-default"
                    checked={editGateway.is_default}
                    onCheckedChange={(checked) => setEditGateway({ 
                      ...editGateway, 
                      is_default: checked 
                    })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditGatewayDialog(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleUpdateGateway} disabled={creating}>
              {creating ? "Oppdaterer..." : "Lagre endringer"}
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
                {selectedGroup.gateway_name && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Radio className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">Gateway</h3>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <Radio className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{selectedGroup.gateway_name}</span>
                      {selectedGroup.is_gateway_inherited && (
                        <Badge variant="outline" className="text-xs">Arvet fra parent</Badge>
                      )}
                    </div>
                  </div>
                )}

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
                  <Button variant="outline" className="flex-1" onClick={() => handleEditGroup(selectedGroup)}>
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