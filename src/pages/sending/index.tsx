import React, { useState, useEffect } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Send, Users, MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { messageService } from "@/services/messageService";
import { formatPhoneNumber } from "@/lib/utils";

type Group = { 
  id: string; 
  name: string; 
  kind: string;
  gateway_id: string | null;
};

type Contact = {
  id: string;
  name: string;
  phone_number: string;
};

export default function SendingPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [messageContent, setMessageContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sendingStats, setSendingStats] = useState({ total: 0, sent: 0, failed: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [groupsRes, contactsRes] = await Promise.all([
        supabase.from("groups").select("*").eq("kind", "operational").order("name"),
        supabase.from("contacts").select("*").order("name"),
      ]);

      if (groupsRes.data) setGroups(groupsRes.data);
      if (contactsRes.data) setContacts(contactsRes.data as unknown as Contact[]);

      if (groupsRes.data && groupsRes.data.length > 0) {
        setSelectedGroup(groupsRes.data[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleSendToSingle = async () => {
    if (!recipientPhone || !messageContent) {
      toast({
        title: "Mangler informasjon",
        description: "Fyll ut telefonnummer og melding",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("users")
        .select("id, tenant_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      const { data: gateway } = await supabase
        .from("gateways")
        .select("id, phone_number")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (!gateway) throw new Error("No active gateway found");

      await messageService.sendMessage(
        messageContent,
        recipientPhone,
        gateway.phone_number,
        undefined, // threadId
        groups.length > 0 ? groups[0].id : undefined // Default to first group if sending single, or add UI selector
      );

      toast({
        title: "Melding sendt!",
        description: `Melding sendt til ${recipientPhone}`,
      });

      setRecipientPhone("");
      setMessageContent("");
    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast({
        title: "Feil ved sending",
        description: error.message || "Kunne ikke sende melding",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendToGroup = async () => {
    if (!selectedGroup || !messageContent) {
      toast({
        title: "Mangler informasjon",
        description: "Velg gruppe og skriv melding",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSendingStats({ total: 0, sent: 0, failed: 0 });

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("users")
        .select("id, tenant_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      const { data: gateway } = await supabase
        .from("gateways")
        .select("phone_number")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (!gateway) throw new Error("No active gateway found");

      const { data: groupMembers } = await supabase
        .from("group_memberships")
        .select("users(id, phone_number)")
        .eq("group_id", selectedGroup);

      if (!groupMembers || groupMembers.length === 0) {
        toast({
          title: "Ingen mottakere",
          description: "Gruppen har ingen medlemmer",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const recipients = groupMembers
        .map((m: any) => m.users?.phone_number)
        .filter((p: string | null | undefined) => p);

      setSendingStats({ total: recipients.length, sent: 0, failed: 0 });

      let sent = 0;
      let failed = 0;

      for (const phone of recipients) {
        try {
          await messageService.sendMessage(
            messageContent,
            phone,
            gateway.phone_number,
            undefined, // threadId
            selectedGroup // Explicitly use the selected group
          );
          sent++;
          setSendingStats({ total: recipients.length, sent, failed });
        } catch (err) {
          console.error(`Failed to send to ${phone}:`, err);
          failed++;
          setSendingStats({ total: recipients.length, sent, failed });
        }
      }

      toast({
        title: "Utsending fullført",
        description: `${sent} av ${recipients.length} meldinger sendt`,
      });

      setMessageContent("");
    } catch (error: any) {
      console.error("Failed to send to group:", error);
      toast({
        title: "Feil ved gruppeutsending",
        description: error.message || "Kunne ikke sende meldinger",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendToContacts = async () => {
    if (selectedContacts.length === 0 || !messageContent) {
      toast({
        title: "Mangler informasjon",
        description: "Velg kontakter og skriv melding",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSendingStats({ total: selectedContacts.length, sent: 0, failed: 0 });

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("users")
        .select("id, tenant_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      const { data: gateway } = await supabase
        .from("gateways")
        .select("phone_number")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (!gateway) throw new Error("No active gateway found");

      const selectedContactData = contacts.filter((c) =>
        selectedContacts.includes(c.id)
      );

      let sent = 0;
      let failed = 0;

      for (const contact of selectedContactData) {
        try {
          await messageService.sendMessage(
            messageContent,
            contact.phone_number,
            gateway.phone_number,
            undefined,
            groups.length > 0 ? groups[0].id : undefined // Default to first operational group for now
          );
          sent++;
          setSendingStats({ total: selectedContacts.length, sent, failed });
        } catch (err) {
          console.error(`Failed to send to ${contact.phone_number}:`, err);
          failed++;
          setSendingStats({ total: selectedContacts.length, sent, failed });
        }
      }

      toast({
        title: "Utsending fullført",
        description: `${sent} av ${selectedContacts.length} meldinger sendt`,
      });

      setMessageContent("");
      setSelectedContacts([]);
    } catch (error: any) {
      console.error("Failed to send to contacts:", error);
      toast({
        title: "Feil ved utsending",
        description: error.message || "Kunne ikke sende meldinger",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  return (
    <>
      <Head>
        <title>Send melding - SeMSe 2.0</title>
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Send SMS</h1>
            <p className="text-muted-foreground mt-2">
              Send meldinger til enkeltpersoner, grupper eller kontakter
            </p>
          </div>

          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single">
                <MessageSquare className="h-4 w-4 mr-2" />
                Enkeltmelding
              </TabsTrigger>
              <TabsTrigger value="group">
                <Users className="h-4 w-4 mr-2" />
                Send til gruppe
              </TabsTrigger>
              <TabsTrigger value="contacts">
                <Users className="h-4 w-4 mr-2" />
                Send til kontakter
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Send til enkeltperson</CardTitle>
                  <CardDescription>
                    Send en melding til ett telefonnummer. Svaret vil havne i din gruppes innboks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipient-phone">Mottakers telefonnummer</Label>
                    <Input
                      id="recipient-phone"
                      placeholder="+4799999999"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="single-message">Melding</Label>
                    <Textarea
                      id="single-message"
                      placeholder="Skriv din melding her..."
                      rows={6}
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {messageContent.length} / 160 tegn
                    </p>
                  </div>

                  <Button
                    onClick={handleSendToSingle}
                    disabled={loading || !recipientPhone || !messageContent}
                    className="w-full"
                  >
                    {loading ? "Sender..." : "Send Melding"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="group" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Send til gruppe</CardTitle>
                  <CardDescription>
                    Send melding til alle medlemmer i en gruppe. Svar vil havne i avsenderens gruppes innboks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-select">Velg gruppe</Label>
                    <select
                      id="group-select"
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                    >
                      {groups.length === 0 && (
                        <option value="">Ingen grupper funnet</option>
                      )}
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="group-message">Melding</Label>
                    <Textarea
                      id="group-message"
                      placeholder="Skriv din melding her..."
                      rows={6}
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {messageContent.length} / 160 tegn
                    </p>
                  </div>

                  {loading && sendingStats.total > 0 && (
                    <div className="p-4 border rounded space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Sender meldinger...</span>
                        <span>
                          {sendingStats.sent + sendingStats.failed} / {sendingStats.total}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span>{sendingStats.sent} sendt</span>
                        </div>
                        {sendingStats.failed > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-destructive" />
                            <span>{sendingStats.failed} feilet</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleSendToGroup}
                    disabled={loading || !selectedGroup || !messageContent}
                    className="w-full"
                  >
                    {loading ? "Sender..." : "Send til Gruppe"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Velg kontakter</CardTitle>
                    <CardDescription>
                      {selectedContacts.length} kontakt(er) valgt
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {contacts.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          Ingen kontakter funnet
                        </p>
                      ) : (
                        contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className={`p-3 border rounded cursor-pointer hover:border-primary transition-colors ${
                              selectedContacts.includes(contact.id)
                                ? "border-primary bg-primary/5"
                                : ""
                            }`}
                            onClick={() => toggleContactSelection(contact.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  {contact.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {contact.phone_number}
                                </p>
                              </div>
                              {selectedContacts.includes(contact.id) && (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Skriv melding</CardTitle>
                    <CardDescription>
                      Meldingen sendes til alle valgte kontakter
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="contacts-message">Melding</Label>
                      <Textarea
                        id="contacts-message"
                        placeholder="Skriv din melding her..."
                        rows={10}
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {messageContent.length} / 160 tegn
                      </p>
                    </div>

                    {loading && sendingStats.total > 0 && (
                      <div className="p-4 border rounded space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Sender meldinger...</span>
                          <span>
                            {sendingStats.sent + sendingStats.failed} / {sendingStats.total}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            <span>{sendingStats.sent} sendt</span>
                          </div>
                          {sendingStats.failed > 0 && (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-destructive" />
                              <span>{sendingStats.failed} feilet</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSendToContacts}
                      disabled={loading || selectedContacts.length === 0 || !messageContent}
                      className="w-full"
                    >
                      {loading ? "Sender..." : `Send til ${selectedContacts.length} kontakt(er)`}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Viktig informasjon om nytt trådsystem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">NY LOGIKK</Badge>
                  <p>
                    <strong>Én tråd per telefonnummer:</strong> Systemet oppretter nå kun én samtale per unikt telefonnummer, uavhengig av hvilken gruppe som sender eller mottar meldinger.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">DYNAMISK</Badge>
                  <p>
                    <strong>Automatisk gruppe-tildeling:</strong> Når du sender en melding til en kontakt, settes trådens gruppe automatisk til din gruppe. Hvis kontakten svarer, havner svaret i samme tråd.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">BULK</Badge>
                  <p>
                    <strong>Bulk-meldinger:</strong> Når du sender til en gruppe, får hver mottaker sin egen tråd knyttet til din gruppe. Svar havner automatisk riktig.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">FLEKSIBELT</Badge>
                  <p>
                    <strong>Kontekstbasert routing:</strong> Systemet husker siste interaksjon og router nye meldinger fra samme nummer til riktig gruppe basert på historikk.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </>
  );
}