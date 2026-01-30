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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GroupHierarchy } from "@/components/GroupHierarchy";
import { groupService } from "@/services/groupService";
import { userService } from "@/services/userService";
import { Users, FolderTree, Shield, Plus, Settings } from "lucide-react";

type GroupNode = {
  id: string;
  name: string;
  kind: "structural" | "operational";
  parent_id: string | null;
  member_count?: number;
  on_duty_count?: number;
  children?: GroupNode[];
};

type User = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  tenant_id: string;
  groups?: string[];
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("groups");
  const [groups, setGroups] = useState<GroupNode[]>([]);
  const [allGroups, setAllGroups] = useState<GroupNode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newGroup, setNewGroup] = useState({
    name: "",
    kind: "operational" as "structural" | "operational",
    parent_id: null as string | null,
    description: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsData, usersData, currentUserData] = await Promise.all([
        groupService.getGroupsHierarchy(),
        userService.getAllUsers(),
        userService.getCurrentUser(),
      ]);
      setGroups(groupsData as GroupNode[]);
      
      // Flatten hierarchy for parent selection
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
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setLoading(false);
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

      // Reset form and close dialog
      setNewGroup({
        name: "",
        kind: "operational",
        parent_id: null,
        description: "",
      });
      setShowCreateDialog(false);

      // Reload data
      await loadData();
    } catch (error) {
      console.error("Failed to create group:", error);
      alert("Feil ved opprettelse av gruppe");
    } finally {
      setCreating(false);
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Administrasjon</h2>
              <p className="text-muted-foreground mt-2">
                Administrer brukere, grupper og systeminnstillinger.
              </p>
            </div>
            <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Opprett ny gruppe
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="groups" className="gap-2">
                <FolderTree className="h-4 w-4" />
                Grupper
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Brukere
              </TabsTrigger>
              <TabsTrigger value="roles" className="gap-2">
                <Shield className="h-4 w-4" />
                Roller
              </TabsTrigger>
            </TabsList>

            {/* Groups Tab with Hierarchy */}
            <TabsContent value="groups" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gruppehierarki</CardTitle>
                  <CardDescription>
                    Hierarkisk visning av alle strukturelle og operasjonelle grupper. Operasjonelle grupper (innbokser) vises med <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 bg-primary rounded"></span> blå ikon</span>, strukturelle grupper med <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 bg-muted-foreground rounded"></span> grå ikon</span>.
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
                      <div className="border rounded-lg p-4">
                        <GroupHierarchy
                          groups={groups}
                          onSelectGroup={setSelectedGroup}
                          selectedGroupId={selectedGroup?.id}
                        />
                      </div>

                      {selectedGroup && (
                        <div className="border rounded-lg p-4 bg-accent/50">
                          <h3 className="font-semibold text-lg mb-2">{selectedGroup.name}</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Type:</span>
                              <Badge className="ml-2" variant={selectedGroup.kind === "operational" ? "default" : "secondary"}>
                                {selectedGroup.kind === "operational" ? "Operasjonell" : "Strukturell"}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Medlemmer:</span>
                              <span className="ml-2 font-semibold">{selectedGroup.member_count || 0}</span>
                            </div>
                            {selectedGroup.kind === "operational" && (
                              <div>
                                <span className="text-muted-foreground">På vakt:</span>
                                <span className="ml-2 font-semibold text-green-600">{selectedGroup.on_duty_count || 0}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button variant="outline" size="sm" className="gap-2">
                              <Settings className="h-4 w-4" />
                              Konfigurer
                            </Button>
                            <Button variant="outline" size="sm">
                              Administrer medlemmer
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
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
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Opprett første bruker
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Navn</TableHead>
                          <TableHead>E-post</TableHead>
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
                            <TableCell>
                              <Badge
                                variant={
                                  user.role === "tenant_admin"
                                    ? "default"
                                    : user.role === "group_admin"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {user.role === "tenant_admin"
                                  ? "Leier-admin"
                                  : user.role === "group_admin"
                                  ? "Gruppe-admin"
                                  : "Medlem"}
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Roles Tab */}
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
                        <h3 className="font-semibold text-lg">Leier-administrator</h3>
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

      {/* Create Group Dialog */}
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
    </>
  );
}