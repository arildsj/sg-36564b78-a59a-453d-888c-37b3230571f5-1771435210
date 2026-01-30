import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, FolderTree, Phone, Clock, MessageSquare, CheckCircle2 } from "lucide-react";

type OnboardingStep = "tenant" | "users" | "groups" | "gateway" | "hours" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("tenant");
  const [tenantId, setTenantId] = useState<string>("");
  const [groupIds, setGroupIds] = useState<{ [key: string]: string }>({});
  const [createdGroups, setCreatedGroups] = useState<Array<{ id: string; name: string }>>([]);

  const [tenantData, setTenantData] = useState({ name: "" });
  const [users, setUsers] = useState([{ name: "", email: "", phone: "", role: "member" }]);
  const [groups, setGroups] = useState([
    { name: "", description: "", kind: "operational", timezone: "Europe/Oslo", parent_id: null as string | null },
  ]);
  const [gateway, setGateway] = useState({ name: "", phone: "" });
  const [openingHours, setOpeningHours] = useState({
    monday: { isOpen: true, open: "08:00", close: "16:00" },
    tuesday: { isOpen: true, open: "08:00", close: "16:00" },
    wednesday: { isOpen: true, open: "08:00", close: "16:00" },
    thursday: { isOpen: true, open: "08:00", close: "16:00" },
    friday: { isOpen: true, open: "08:00", close: "16:00" },
    saturday: { isOpen: false, open: "", close: "" },
    sunday: { isOpen: false, open: "", close: "" },
  });

  const steps: { id: OnboardingStep; label: string; icon: React.ReactNode }[] = [
    { id: "tenant", label: "Organisasjon", icon: <Building2 className="h-5 w-5" /> },
    { id: "users", label: "Brukere", icon: <Users className="h-5 w-5" /> },
    { id: "groups", label: "Grupper", icon: <FolderTree className="h-5 w-5" /> },
    { id: "gateway", label: "Gateway", icon: <Phone className="h-5 w-5" /> },
    { id: "hours", label: "Åpningstider", icon: <Clock className="h-5 w-5" /> },
    { id: "complete", label: "Fullført", icon: <CheckCircle2 className="h-5 w-5" /> },
  ];

  const handleCreateTenant = async () => {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .insert({ name: tenantData.name })
        .select()
        .single();

      if (error) throw error;
      setTenantId(data.id);
      setCurrentStep("users");
    } catch (error) {
      console.error("Failed to create tenant:", error);
      alert("Feil ved opprettelse av organisasjon");
    }
  };

  const handleCreateUsers = async () => {
    try {
      const usersToCreate = users.filter((u) => u.name && u.phone);
      if (usersToCreate.length === 0) {
        alert("Legg til minst én bruker");
        return;
      }

      const { error } = await supabase.from("users").insert(
        usersToCreate.map((u) => ({
          tenant_id: tenantId,
          name: u.name,
          email: u.email || null,
          phone_number: u.phone,
          role: u.role as "tenant_admin" | "group_admin" | "member",
          status: "active",
        }))
      );

      if (error) throw error;
      setCurrentStep("groups");
    } catch (error) {
      console.error("Failed to create users:", error);
      alert("Feil ved opprettelse av brukere");
    }
  };

  const handleCreateGroups = async () => {
    try {
      const groupsToCreate = groups.filter((g) => g.name);
      if (groupsToCreate.length === 0) {
        alert("Legg til minst én gruppe");
        return;
      }

      const { data, error } = await supabase
        .from("groups")
        .insert(
          groupsToCreate.map((g) => ({
            tenant_id: tenantId,
            name: g.name,
            description: g.description || null,
            kind: g.kind as "structural" | "operational",
            timezone: g.timezone,
            parent_id: g.parent_id,
            escalation_enabled: true,
            escalation_timeout_minutes: 30,
          }))
        )
        .select();

      if (error) throw error;
      
      const ids: { [key: string]: string } = {};
      const created: Array<{ id: string; name: string }> = [];
      data.forEach((group, idx) => {
        ids[groupsToCreate[idx].name] = group.id;
        created.push({ id: group.id, name: group.name });
      });
      setGroupIds(ids);
      setCreatedGroups(created);
      
      setCurrentStep("gateway");
    } catch (error) {
      console.error("Failed to create groups:", error);
      alert("Feil ved opprettelse av grupper");
    }
  };

  const handleCreateGateway = async () => {
    try {
      if (!gateway.name || !gateway.phone) {
        alert("Fyll ut gateway-informasjon");
        return;
      }

      const firstGroupId = Object.values(groupIds)[0];
      if (!firstGroupId) {
        alert("Ingen grupper funnet");
        return;
      }

      const { error } = await supabase.from("gateways").insert({
        tenant_id: tenantId,
        name: gateway.name,
        phone_number: gateway.phone,
        fallback_group_id: firstGroupId,
        status: "active",
      });

      if (error) throw error;
      setCurrentStep("hours");
    } catch (error) {
      console.error("Failed to create gateway:", error);
      alert("Feil ved opprettelse av gateway");
    }
  };

  const handleCreateOpeningHours = async () => {
    try {
      const dayMap = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 0,
      };

      for (const groupId of Object.values(groupIds)) {
        const hoursToInsert = Object.entries(openingHours).map(([day, hours]) => ({
          group_id: groupId,
          day_of_week: dayMap[day as keyof typeof dayMap],
          is_open: hours.isOpen,
          open_time: hours.isOpen ? hours.open : null,
          close_time: hours.isOpen ? hours.close : null,
        }));

        const { error } = await supabase.from("opening_hours").insert(hoursToInsert);
        if (error) throw error;

        const { error: replyError } = await supabase.from("automatic_replies").insert([
          {
            group_id: groupId,
            trigger_type: "outside_hours",
            message_template: "Takk for din henvendelse. Vi er stengt. Se våre åpningstider for mer info.",
            cooldown_minutes: 120,
            is_active: true,
          },
          {
            group_id: groupId,
            trigger_type: "first_message",
            message_template: "Velkommen! Din melding er mottatt og vil bli behandlet snarest.",
            cooldown_minutes: 1440,
            is_active: true,
          },
        ]);

        if (replyError) throw replyError;
      }

      setCurrentStep("complete");
    } catch (error) {
      console.error("Failed to create opening hours:", error);
      alert("Feil ved opprettelse av åpningstider");
    }
  };

  const addUser = () => {
    setUsers([...users, { name: "", email: "", phone: "", role: "member" }]);
  };

  const addGroup = () => {
    setGroups([...groups, { name: "", description: "", kind: "operational", timezone: "Europe/Oslo", parent_id: null }]);
  };

  return (
    <>
      <Head>
        <title>Onboarding - SeMSe 2.0</title>
      </Head>

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Velkommen til SeMSe 2.0</h1>
            <p className="text-muted-foreground mt-2">
              La oss sette opp organisasjonen din steg for steg
            </p>
          </div>

          <div className="flex items-center justify-between mb-8">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex flex-col items-center ${
                    currentStep === step.id
                      ? "text-primary"
                      : steps.findIndex((s) => s.id === currentStep) > idx
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                      currentStep === step.id
                        ? "border-primary bg-primary/10"
                        : steps.findIndex((s) => s.id === currentStep) > idx
                        ? "border-primary bg-primary text-white"
                        : "border-muted"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span className="text-xs mt-2 font-medium">{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 ${
                      steps.findIndex((s) => s.id === currentStep) > idx
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {currentStep === "tenant" && (
            <Card>
              <CardHeader>
                <CardTitle>Opprett organisasjon</CardTitle>
                <CardDescription>
                  Dette er toppnivået i hierarkiet ditt. Alt tilhører en organisasjon (tenant).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant-name">Organisasjonsnavn</Label>
                  <Input
                    id="tenant-name"
                    placeholder="Fair Teknologi AS"
                    value={tenantData.name}
                    onChange={(e) => setTenantData({ name: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreateTenant} className="w-full">
                  Neste: Legg til brukere
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === "users" && (
            <Card>
              <CardHeader>
                <CardTitle>Legg til brukere</CardTitle>
                <CardDescription>
                  Brukere som skal ha tilgang til systemet. Du kan legge til flere senere.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {users.map((user, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-4 p-4 border rounded">
                    <div className="space-y-2">
                      <Label htmlFor={`user-name-${idx}`}>Navn</Label>
                      <Input
                        id={`user-name-${idx}`}
                        placeholder="Ola Nordmann"
                        value={user.name}
                        onChange={(e) => {
                          const newUsers = [...users];
                          newUsers[idx].name = e.target.value;
                          setUsers(newUsers);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`user-email-${idx}`}>E-post</Label>
                      <Input
                        id={`user-email-${idx}`}
                        type="email"
                        placeholder="ola@example.com"
                        value={user.email}
                        onChange={(e) => {
                          const newUsers = [...users];
                          newUsers[idx].email = e.target.value;
                          setUsers(newUsers);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`user-phone-${idx}`}>Telefon</Label>
                      <Input
                        id={`user-phone-${idx}`}
                        placeholder="+4791234567"
                        value={user.phone}
                        onChange={(e) => {
                          const newUsers = [...users];
                          newUsers[idx].phone = e.target.value;
                          setUsers(newUsers);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`user-role-${idx}`}>Rolle</Label>
                      <select
                        id={`user-role-${idx}`}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={user.role}
                        onChange={(e) => {
                          const newUsers = [...users];
                          newUsers[idx].role = e.target.value;
                          setUsers(newUsers);
                        }}
                      >
                        <option value="member">Medlem</option>
                        <option value="group_admin">Gruppe-admin</option>
                        <option value="tenant_admin">Tenant-admin</option>
                      </select>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addUser} className="w-full">
                  + Legg til bruker
                </Button>
                <Button onClick={handleCreateUsers} className="w-full">
                  Neste: Opprett grupper
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === "groups" && (
            <Card>
              <CardHeader>
                <CardTitle>Opprett grupper</CardTitle>
                <CardDescription>
                  Grupper (innbokser) for å organisere meldinger. Kun operational-grupper har innbokser. Du kan bygge et hierarki ved å velge en overordnet gruppe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {groups.map((group, idx) => (
                  <div key={idx} className="p-4 border rounded space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`group-name-${idx}`}>Gruppenavn</Label>
                        <Input
                          id={`group-name-${idx}`}
                          placeholder="Kundeservice"
                          value={group.name}
                          onChange={(e) => {
                            const newGroups = [...groups];
                            newGroups[idx].name = e.target.value;
                            setGroups(newGroups);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`group-kind-${idx}`}>Type</Label>
                        <select
                          id={`group-kind-${idx}`}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background"
                          value={group.kind}
                          onChange={(e) => {
                            const newGroups = [...groups];
                            newGroups[idx].kind = e.target.value;
                            setGroups(newGroups);
                          }}
                        >
                          <option value="operational">Operasjonell (har innboks)</option>
                          <option value="structural">Strukturell (kun organisering)</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`group-desc-${idx}`}>Beskrivelse</Label>
                        <Input
                          id={`group-desc-${idx}`}
                          placeholder="Behandler kundehenvendelser"
                          value={group.description}
                          onChange={(e) => {
                            const newGroups = [...groups];
                            newGroups[idx].description = e.target.value;
                            setGroups(newGroups);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`group-parent-${idx}`}>Overordnet gruppe (valgfri)</Label>
                        <select
                          id={`group-parent-${idx}`}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background"
                          value={group.parent_id || ""}
                          onChange={(e) => {
                            const newGroups = [...groups];
                            newGroups[idx].parent_id = e.target.value || null;
                            setGroups(newGroups);
                          }}
                        >
                          <option value="">Ingen (rotgruppe)</option>
                          {createdGroups
                            .filter((g) => groups[idx].name !== g.name)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addGroup} className="w-full">
                  + Legg til gruppe
                </Button>
                <Button onClick={handleCreateGroups} className="w-full">
                  Neste: Konfigurer gateway
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === "gateway" && (
            <Card>
              <CardHeader>
                <CardTitle>Konfigurer FairGateway</CardTitle>
                <CardDescription>
                  Gateway som mottar og sender SMS. Telefonnummeret som skal brukes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gateway-name">Gateway-navn</Label>
                  <Input
                    id="gateway-name"
                    placeholder="FairGateway Hovedkontor"
                    value={gateway.name}
                    onChange={(e) => setGateway({ ...gateway, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gateway-phone">Telefonnummer</Label>
                  <Input
                    id="gateway-phone"
                    placeholder="+4740123456"
                    value={gateway.phone}
                    onChange={(e) => setGateway({ ...gateway, phone: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreateGateway} className="w-full">
                  Neste: Sett åpningstider
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === "hours" && (
            <Card>
              <CardHeader>
                <CardTitle>Åpningstider</CardTitle>
                <CardDescription>
                  Standard åpningstider som gjelder for alle grupper (kan endres senere per gruppe).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(openingHours).map(([day, hours]) => (
                  <div key={day} className="grid grid-cols-4 gap-4 items-center">
                    <Label className="capitalize">{day === "monday" ? "Mandag" : day === "tuesday" ? "Tirsdag" : day === "wednesday" ? "Onsdag" : day === "thursday" ? "Torsdag" : day === "friday" ? "Fredag" : day === "saturday" ? "Lørdag" : "Søndag"}</Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`${day}-open`}
                        checked={hours.isOpen}
                        onChange={(e) => {
                          setOpeningHours({
                            ...openingHours,
                            [day]: { ...hours, isOpen: e.target.checked },
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`${day}-open`}>Åpen</Label>
                    </div>
                    {hours.isOpen && (
                      <>
                        <Input
                          type="time"
                          value={hours.open}
                          onChange={(e) => {
                            setOpeningHours({
                              ...openingHours,
                              [day]: { ...hours, open: e.target.value },
                            });
                          }}
                        />
                        <Input
                          type="time"
                          value={hours.close}
                          onChange={(e) => {
                            setOpeningHours({
                              ...openingHours,
                              [day]: { ...hours, close: e.target.value },
                            });
                          }}
                        />
                      </>
                    )}
                  </div>
                ))}
                <Button onClick={handleCreateOpeningHours} className="w-full">
                  Fullfør oppsett
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === "complete" && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                  Oppsett fullført!
                </CardTitle>
                <CardDescription>
                  Organisasjonen din er nå klar til bruk. Du kan nå:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 list-disc list-inside text-sm">
                  <li>Logge inn med brukerne du opprettet</li>
                  <li>Legge til flere grupper og brukere i Admin-panelet</li>
                  <li>Sette brukere on-duty for å motta meldinger</li>
                  <li>Teste systemet med simulerte SMS-meldinger</li>
                  <li>Konfigurere routing-regler og auto-svar</li>
                </ul>
                <div className="flex gap-4">
                  <Button onClick={() => router.push("/simulate")} className="flex-1">
                    Test med simulering
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/")} className="flex-1">
                    Gå til dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}