import React from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, MessageSquare, Bell, Save, Network } from "lucide-react";
import { RoutingRulesTab } from "@/components/settings/RoutingRulesTab";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState("hours");

  return (
    <>
      <Head>
        <title>Innstillinger | SeMSe</title>
        <meta name="description" content="Konfigurer åpningstider, auto-svar og varsler" />
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Innstillinger</h2>
            <p className="text-muted-foreground mt-2">
              Konfigurer åpningstider, automatiske svar og varslinger for dine grupper.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="hours" className="gap-2">
                <Clock className="h-4 w-4" />
                Åpningstider
              </TabsTrigger>
              <TabsTrigger value="replies" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Auto-svar
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                Varsler
              </TabsTrigger>
              <TabsTrigger value="routing" className="gap-2">
                <Network className="h-4 w-4" />
                Routing
              </TabsTrigger>
            </TabsList>

            {/* Opening Hours Tab */}
            <TabsContent value="hours" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Åpningstider</CardTitle>
                  <CardDescription>
                    Definer når innboksen er åpen. Brukes for automatiske svar og routing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="group-select">Velg gruppe</Label>
                    <Select defaultValue="kundeservice">
                      <SelectTrigger id="group-select" className="focus:ring-2 focus:ring-primary">
                        <SelectValue placeholder="Velg en gruppe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kundeservice">Kundeservice</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="salg">Salg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <h3 className="font-semibold">Ukentlig timeplan</h3>
                    {["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"].map((day) => (
                      <div key={day} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <Label className="font-medium">{day}</Label>
                        <div className="flex items-center gap-2">
                          <Switch id={`${day}-enabled`} defaultChecked={day !== "Søndag"} />
                          <Label htmlFor={`${day}-enabled`} className="text-sm text-muted-foreground">
                            Åpen
                          </Label>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${day}-from`} className="text-xs">
                            Fra
                          </Label>
                          <Input
                            type="time"
                            id={`${day}-from`}
                            defaultValue="09:00"
                            className="focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${day}-to`} className="text-xs">
                            Til
                          </Label>
                          <Input
                            type="time"
                            id={`${day}-to`}
                            defaultValue="16:00"
                            className="focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <h3 className="font-semibold">Spesielle dager (unntak)</h3>
                    <p className="text-sm text-muted-foreground">
                      Legg til helligdager eller andre spesielle datoer hvor åpningstidene avviker.
                    </p>
                    <Button variant="outline">Legg til unntak</Button>
                  </div>

                  <div className="flex justify-end">
                    <Button className="gap-2">
                      <Save className="h-4 w-4" />
                      Lagre åpningstider
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Auto Replies Tab */}
            <TabsContent value="replies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Automatiske svar</CardTitle>
                  <CardDescription>
                    Konfigurer meldinger som sendes automatisk basert på betingelser.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="reply-group-select">Velg gruppe</Label>
                    <Select defaultValue="kundeservice">
                      <SelectTrigger id="reply-group-select" className="focus:ring-2 focus:ring-primary">
                        <SelectValue placeholder="Velg en gruppe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kundeservice">Kundeservice</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="salg">Salg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Utenfor åpningstid</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Send automatisk melding når vi er stengt.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outside-hours-message">Melding</Label>
                      <Textarea
                        id="outside-hours-message"
                        placeholder="Takk for din henvendelse. Vi er stengt nå, men svarer så snart vi åpner igjen."
                        rows={4}
                        className="focus:ring-2 focus:ring-primary"
                        defaultValue="Takk for din henvendelse. Vi har stengt for i dag, men svarer så snart vi åpner igjen."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Første melding</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Send velkomstmelding til nye kontakter.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first-message">Melding</Label>
                      <Textarea
                        id="first-message"
                        placeholder="Velkommen! Vi har mottatt din melding og svarer så snart som mulig."
                        rows={4}
                        className="focus:ring-2 focus:ring-primary"
                        defaultValue="Velkommen! Vi har mottatt din melding og svarer så snart som mulig."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Nøkkelord-basert</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Send spesifikk melding når visse nøkkelord oppdages.
                        </p>
                      </div>
                      <Switch />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="keywords">Nøkkelord (kommaseparert)</Label>
                      <Input
                        id="keywords"
                        placeholder="hjelp, support, akutt"
                        className="focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="keyword-message">Melding</Label>
                      <Textarea
                        id="keyword-message"
                        placeholder="Vi ser at du trenger hjelp. En av våre medarbeidere vil kontakte deg snart."
                        rows={4}
                        className="focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="gap-2">
                      <Save className="h-4 w-4" />
                      Lagre auto-svar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Varselsinnstillinger</CardTitle>
                  <CardDescription>
                    Velg hvordan du vil motta varsler om nye meldinger.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="font-semibold">E-postvarsler</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Motta varsler på e-post om nye meldinger.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="font-semibold">Push-varsler</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Motta push-varsler i nettleseren.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="font-semibold">SMS-varsler</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Motta SMS-varsler for kritiske meldinger.
                        </p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Kun når på vakt</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Motta bare varsler når du er markert som på vakt.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button className="gap-2">
                      <Save className="h-4 w-4" />
                      Lagre innstillinger
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Routing Rules Tab */}
            <TabsContent value="routing" className="space-y-4">
              <RoutingRulesTab />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </>
  );
}