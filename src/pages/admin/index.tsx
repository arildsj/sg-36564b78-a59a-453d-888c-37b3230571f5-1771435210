import React from "react";
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
import { Users, FolderTree, Shield, Plus, Settings } from "lucide-react";

// Mock data
const MOCK_USERS = [
  {
    id: "1",
    name: "Ola Nordmann",
    email: "ola@example.com",
    role: "tenant_admin",
    status: "active",
    groups: ["Support", "Kundeservice"],
  },
  {
    id: "2",
    name: "Kari Hansen",
    email: "kari@example.com",
    role: "member",
    status: "active",
    groups: ["Support"],
  },
  {
    id: "3",
    name: "Per Jensen",
    email: "per@example.com",
    role: "group_admin",
    status: "active",
    groups: ["Kundeservice"],
  },
];

const MOCK_GROUPS = [
  {
    id: "1",
    name: "Kundeservice",
    kind: "operational",
    parent: null,
    member_count: 5,
    on_duty_count: 2,
  },
  {
    id: "2",
    name: "Support",
    kind: "operational",
    parent: null,
    member_count: 3,
    on_duty_count: 1,
  },
  {
    id: "3",
    name: "Salg",
    kind: "structural",
    parent: null,
    member_count: 0,
    on_duty_count: 0,
  },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = React.useState("users");

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
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Opprett ny
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Brukere
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-2">
                <FolderTree className="h-4 w-4" />
                Grupper
              </TabsTrigger>
              <TabsTrigger value="roles" className="gap-2">
                <Shield className="h-4 w-4" />
                Roller
              </TabsTrigger>
            </TabsList>

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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>E-post</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Grupper</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_USERS.map((user) => (
                        <TableRow key={user.id} className="hover:bg-accent">
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
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
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.groups.map((group, idx) => (
                                <Badge key={idx} variant="outline">
                                  {group}
                                </Badge>
                              ))}
                            </div>
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* Groups Tab */}
            <TabsContent value="groups" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gruppeadministrasjon</CardTitle>
                  <CardDescription>
                    Administrer hierarkiske grupper og tilganger.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gruppenavn</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Medlemmer</TableHead>
                        <TableHead>På vakt</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_GROUPS.map((group) => (
                        <TableRow key={group.id} className="hover:bg-accent">
                          <TableCell className="font-medium">{group.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={group.kind === "operational" ? "default" : "secondary"}
                            >
                              {group.kind === "operational" ? "Operativ" : "Strukturell"}
                            </Badge>
                          </TableCell>
                          <TableCell>{group.member_count}</TableCell>
                          <TableCell>
                            {group.kind === "operational" ? (
                              <span className="font-semibold text-green-600">
                                {group.on_duty_count} aktive
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="gap-2">
                              <Settings className="h-4 w-4" />
                              Konfigurer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                      <Badge variant="default">3 brukere</Badge>
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
                      <Badge variant="secondary">5 brukere</Badge>
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
                      <Badge variant="outline">15 brukere</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </>
  );
}