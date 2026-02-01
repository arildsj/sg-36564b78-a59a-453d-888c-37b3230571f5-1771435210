import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Clock } from "lucide-react";

type Gateway = { id: string; name: string; phone_number: string };
type Group = { 
  id: string; 
  name: string; 
  kind: string;
  gateway_id: string | null; // Added this field
};
type GroupWithGateway = Group & { 
  gateway?: any;
};

export default function SimulatePage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [fromNumber, setFromNumber] = useState<string>("+4799999999");
  const [messageContent, setMessageContent] = useState<string>("");
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [gatewaysRes, groupsRes, messagesRes] = await Promise.all([
        supabase.from("gateways").select("*").eq("status", "active"),
        supabase.from("groups")
          .select("*, gateway:gateways!groups_gateway_id_fkey(*)")
          .eq("kind", "operational")
          .order("name"),
        supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      if (gatewaysRes.data) setGateways(gatewaysRes.data);
      if (groupsRes.data) setGroups(groupsRes.data as GroupWithGateway[]);
      if (messagesRes.data) setRecentMessages(messagesRes.data);

      if (gatewaysRes.data && gatewaysRes.data.length > 0) {
        setSelectedGateway(gatewaysRes.data[0].id);
      }
      if (groupsRes.data && groupsRes.data.length > 0) {
        setSelectedGroup(groupsRes.data[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedGroup || !fromNumber || !messageContent) {
      alert("Fyll ut alle felt");
      return;
    }

    setLoading(true);
    try {
      const group = groups.find((g) => g.id === selectedGroup);
      if (!group) throw new Error("Group not found");
      
      // Use the group's gateway, or fallback to the first active gateway if group has none
      const gatewayId = group.gateway_id || (gateways.length > 0 ? gateways[0].id : null);
      
      if (!gatewayId) {
        alert("Ingen gateway funnet for denne gruppen. Vennligst kontakt admin.");
        setLoading(false);
        return;
      }

      const gateway = gateways.find(g => g.id === gatewayId) || (group as any).gateway;

      const { data: tenant } = await supabase.from("tenants").select("id").single();
      if (!tenant) throw new Error("Tenant not found");
      
      // Clean phone number
      const cleanFromNumber = fromNumber.replace(/\s+/g, '');
      const threadKey = `thread_${cleanFromNumber.replace("+", "")}`;

      const { data, error } = await supabase
        .from("messages")
        .insert({
          tenant_id: tenant.id,
          gateway_id: gatewayId,
          group_id: selectedGroup,
          thread_key: threadKey,
          direction: "inbound",
          from_number: cleanFromNumber,
          to_number: gateway?.phone_number || "unknown",
          content: messageContent,
          status: "delivered",
        })
        .select()
        .single();

      if (error) throw error;

      alert("✅ Melding sendt inn til systemet!");
      setMessageContent("");
      loadData();
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("❌ Feil ved sending av melding");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return "nå";
    if (minutes < 60) return `${minutes} min siden`;
    if (hours < 24) return `${hours}t siden`;
    return date.toLocaleDateString("no-NO");
  };

  const selectedGroupData = groups.find((g) => g.id === selectedGroup);
  const gatewayInfo = selectedGroupData?.gateway_id 
    ? `Gateway: ${(selectedGroupData as any).gateway?.phone_number || 'Laster...'}`
    : "Ingen gateway tilknyttet";

  return (
    <>
      <Head>
        <title>Simulering - SeMSe 2.0</title>
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">SMS-simulering</h1>
            <p className="text-muted-foreground mt-2">
              Send inn test-SMS for å teste systemets rutinglogikk og automatiske svar
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send inn melding
                </CardTitle>
                <CardDescription>
                  Simuler en innkommende SMS fra publikum eller kontakt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group">Målgruppe</Label>
                  <select
                    id="group"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                  >
                    {groups.length === 0 && (
                      <option value="">Ingen grupper funnet</option>
                    )}
                    {groups.map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.gateway?.phone_number || 'Ingen gateway'})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {gatewayInfo}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from-number">Fra-nummer (avsender)</Label>
                  <Input
                    id="from-number"
                    placeholder="+4799999999"
                    value={fromNumber}
                    onChange={(e) => setFromNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Bruk +47 for norske nummer
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message-content">Melding</Label>
                  <Textarea
                    id="message-content"
                    placeholder="Hei, jeg lurer på..."
                    rows={5}
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={handleSendMessage} 
                  className="w-full"
                  disabled={loading || !selectedGroup}
                >
                  {loading ? "Sender..." : "Send inn melding"}
                </Button>

                {groups.length === 0 && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded">
                    <p className="text-sm text-destructive">
                      ⚠️ Ingen grupper funnet. Gå til{" "}
                      <Link href="/onboarding" className="underline font-medium">
                        Onboarding
                      </Link>{" "}
                      for å sette opp organisasjonen din.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Nylige meldinger
                </CardTitle>
                <CardDescription>
                  Siste simulerte eller ekte meldinger i systemet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentMessages.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Ingen meldinger ennå. Send inn en test-melding!
                    </p>
                  ) : (
                    recentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3 border rounded hover:border-primary transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={msg.direction === "inbound" ? "default" : "secondary"}>
                              {msg.direction === "inbound" ? "Inn" : "Ut"}
                            </Badge>
                            <span className="text-sm font-medium">{msg.from_number}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{msg.content}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {msg.status}
                          </Badge>
                          {msg.acknowledged_at && (
                            <Badge variant="outline" className="text-xs bg-primary/10">
                              Bekreftet
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tips for testing</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>
                  <strong>Test routing:</strong> Bruk nøkkelord som "KUNDE" eller "TEKNISK" i meldingen for å teste routing-regler
                </li>
                <li>
                  <strong>Test åpningstider:</strong> Systemet vil sende automatisk svar utenfor åpningstid
                </li>
                <li>
                  <strong>Test eskaleringer:</strong> La meldinger ligge ubehandlet for å se eskaleringsprosessen
                </li>
                <li>
                  <strong>Test whitelist:</strong> Legg til nummeret i kontaktlisten først for kjent avsender-håndtering
                </li>
                <li>
                  <strong>Test tråder:</strong> Send flere meldinger fra samme nummer for å se tråd-gruppering
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </>
  );
}