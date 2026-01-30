import React, { useState, useEffect } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Users, Phone, Loader2 } from "lucide-react";
import { groupService } from "@/services/groupService";
import { contactService } from "@/services/contactService";
import { messageService } from "@/services/messageService";
import { supabase } from "@/integrations/supabase/client";

export default function SendingPage() {
  const [recipientType, setRecipientType] = useState<"single" | "group">("single");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [message, setMessage] = useState("");
  const [groups, setGroups] = useState<{id: string, name: string}[]>([]);
  const [groupContacts, setGroupContacts] = useState<{phone_number: string, description: string | null}[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup && recipientType === "group") {
      loadGroupContacts(selectedGroup);
    } else {
      setGroupContacts([]);
    }
  }, [selectedGroup, recipientType]);

  const loadGroups = async () => {
    try {
      const allGroups = await groupService.getAllGroups();
      // Only show operational groups for bulk messaging
      const operationalGroups = allGroups.filter((g: any) => g.kind === 'operational');
      setGroups(operationalGroups);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const loadGroupContacts = async (groupId: string) => {
    try {
      setLoadingContacts(true);
      
      // Get all contacts linked to this group
      const { data, error } = await supabase
        .from("whitelist_group_links")
        .select(`
          whitelisted_number:whitelisted_numbers(
            phone_number,
            description
          )
        `)
        .eq("group_id", groupId);

      if (error) throw error;

      const contacts = data
        ?.map((link: any) => link.whitelisted_number)
        .filter(Boolean) || [];

      setGroupContacts(contacts);
    } catch (error) {
      console.error("Failed to load group contacts:", error);
      setGroupContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      alert("Vennligst skriv en melding");
      return;
    }
    
    if (recipientType === "single" && !phoneNumber.trim()) {
      alert("Vennligst fyll inn telefonnummer");
      return;
    }
    
    if (recipientType === "group" && !selectedGroup) {
      alert("Vennligst velg en gruppe");
      return;
    }

    try {
      setSending(true);

      if (recipientType === "single") {
        // Send to single recipient
        await messageService.sendMessage(
          message,
          phoneNumber,
          "+4790000000", // Default sender (should come from gateway)
          phoneNumber // Thread key is phone number
        );
        alert("Melding sendt!");
        setMessage("");
        setPhoneNumber("");
      } else {
        // Bulk send to group contacts
        if (groupContacts.length === 0) {
          alert("Ingen kontakter funnet i denne gruppen");
          return;
        }

        // Send to all contacts in the group
        const sendPromises = groupContacts.map(contact =>
          messageService.sendMessage(
            message,
            contact.phone_number,
            "+4790000000", // Default sender
            contact.phone_number // Thread key
          )
        );

        await Promise.all(sendPromises);
        alert(`Melding sendt til ${groupContacts.length} kontakter i gruppen!`);
        setMessage("");
        setSelectedGroup("");
      }
    } catch (error: any) {
      console.error("Failed to send:", error);
      alert(`Feil ved sending: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Head>
        <title>Send Melding | SeMSe</title>
        <meta name="description" content="Send SMS til enkeltpersoner eller grupper" />
      </Head>

      <AppLayout>
        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Send Melding</h1>
            <p className="text-muted-foreground mt-2">
              Send SMS til enkeltnumre eller hele kontaktgrupper.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ny melding</CardTitle>
              <CardDescription>
                Velg mottaker og skriv din melding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Mottaker</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={recipientType === "single" ? "default" : "outline"}
                    className="flex-1 gap-2"
                    onClick={() => setRecipientType("single")}
                  >
                    <Phone className="h-4 w-4" />
                    Enkeltnummer
                  </Button>
                  <Button
                    type="button"
                    variant={recipientType === "group" ? "default" : "outline"}
                    className="flex-1 gap-2"
                    onClick={() => setRecipientType("group")}
                  >
                    <Users className="h-4 w-4" />
                    Kontaktgruppe (Bulk)
                  </Button>
                </div>
              </div>

              {recipientType === "single" ? (
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefonnummer</Label>
                  <Input
                    id="phone"
                    placeholder="+47 123 45 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="group">Velg kontaktgruppe</Label>
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                      <SelectTrigger>
                        <SelectValue placeholder="Velg mottakergruppe" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Meldingen sendes til alle kontakter i denne gruppen
                    </p>
                  </div>

                  {selectedGroup && (
                    <div className="border rounded-lg p-4 bg-accent/50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">Mottakere i gruppen:</h4>
                        {loadingContacts ? (
                          <Badge variant="outline">Laster...</Badge>
                        ) : (
                          <Badge variant="default">{groupContacts.length} kontakter</Badge>
                        )}
                      </div>
                      {loadingContacts ? (
                        <p className="text-sm text-muted-foreground">Laster kontakter...</p>
                      ) : groupContacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen kontakter funnet i denne gruppen</p>
                      ) : (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {groupContacts.map((contact, i) => (
                            <div key={i} className="text-xs flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{contact.phone_number}</span>
                              {contact.description && (
                                <span className="text-muted-foreground">— {contact.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="message">Melding</Label>
                <Textarea
                  id="message"
                  placeholder="Skriv din melding her..."
                  className="min-h-[150px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    {message.length} tegn
                  </p>
                  {recipientType === "group" && groupContacts.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sendes til {groupContacts.length} mottaker{groupContacts.length !== 1 ? 'e' : ''}
                    </p>
                  )}
                </div>
              </div>

              <Button 
                className="w-full gap-2" 
                size="lg" 
                onClick={handleSend}
                disabled={sending || !message.trim() || (recipientType === "group" && groupContacts.length === 0)}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sender...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {recipientType === "group" && groupContacts.length > 0
                      ? `Send til ${groupContacts.length} kontakter`
                      : "Send Melding"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </>
  );
}