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
import { Send, Users, MessageSquare, AlertCircle, CheckCircle2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { messageService } from "@/services/messageService";
import { contactService } from "@/services/contactService";
import { bulkService } from "@/services/bulkService";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

type Member = {
  id: string;
  full_name: string;
  phone_number: string;
};

export default function SendingPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  
  // Bulk specific
  const [bulkSubject, setBulkSubject] = useState("");
  const [groupMembers, setGroupMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  // Single tab specific
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [singleSearchOpen, setSingleSearchOpen] = useState(false);
  const [singleSearchValue, setSingleSearchValue] = useState("");
  
  const [messageContent, setMessageContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sendingStats, setSendingStats] = useState({ total: 0, sent: 0, failed: 0 });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMembers(selectedGroup);
    }
  }, [selectedGroup]);

  const loadData = async () => {
    try {
      const { data: groupsData } = await supabase
        .from("groups")
        .select("*")
        .eq("kind", "operational")
        .order("name");
      
      // Use contactService to ensure consistency with Contacts page
      const serviceContacts = await contactService.getAllContacts();

      if (groupsData) setGroups(groupsData);
      
      if (serviceContacts) {
        setContacts(serviceContacts.map(c => ({
          id: c.id,
          name: c.name,
          phone_number: c.phone // Map 'phone' from service to 'phone_number' expected by page
        })));
      }

      if (groupsData && groupsData.length > 0) {
        setSelectedGroup(groupsData[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    try {
      const { data: members, error } = await supabase
        .from("group_memberships")
        .select(`
          user_id,
          users!inner(
            id,
            full_name,
            phone_number
          )
        `)
        .eq("group_id", groupId);

      if (error) throw error;

      if (members) {
        const mappedMembers = members
          .map((m: any) => ({
            id: m.users.id,
            full_name: m.users.full_name || "Ukjent navn",
            phone_number: m.users.phone_number
          }))
          .filter(m => m.phone_number); // Only show members with phone numbers

        setGroupMembers(mappedMembers);
        // Default select all
        setSelectedMembers(mappedMembers.map(m => m.id));
      }
    } catch (error) {
      console.error("Failed to load members:", error);
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
      await messageService.sendMessage(
        messageContent,
        recipientPhone,
        "", // Gateway resolved automatically if empty
        undefined, // threadId
        groups.length > 0 ? selectedGroup : undefined // Use selected group as context
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

  const handleSendBulk = async () => {
    if (!selectedGroup || !messageContent || !bulkSubject) {
      toast({
        title: "Mangler informasjon",
        description: "Velg gruppe, skriv emne og melding",
        variant: "destructive",
      });
      return;
    }

    if (selectedMembers.length === 0) {
      toast({
        title: "Ingen mottakere",
        description: "Du må velge minst én mottaker",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const group = groups.find(g => g.id === selectedGroup);
      
      await bulkService.sendBulkToInternalGroup(
        messageContent,
        selectedGroup,
        group?.name || "Ukjent gruppe",
        bulkSubject,
        selectedMembers
      );

      toast({
        title: "Bulk-utsendelse startet",
        description: `Sender til ${selectedMembers.length} medlemmer...`,
      });

      setMessageContent("");
      setBulkSubject("");
      // Refresh logic could go here
    } catch (error: any) {
      console.error("Failed to send bulk:", error);
      toast({
        title: "Feil ved utsending",
        description: error.message || "Kunne ikke starte utsendelse",
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
      // Fetch members
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
            "", 
            undefined, 
            selectedGroup // Context is the group we are sending FROM (and to)
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
            "",
            undefined,
            selectedGroup // Use current selected group as sender context
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

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleSelectAllMembers = () => {
    if (selectedMembers.length === groupMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(groupMembers.map(m => m.id));
    }
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

          {/* Global Group Context Selector */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="global-group">Send fra gruppe:</Label>
                <div className="flex items-center gap-2 mt-1.5">
                   <Users className="h-4 w-4 text-muted-foreground" />
                   <select
                      id="global-group"
                      className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                    >
                      {groups.length === 0 && <option value="">Ingen grupper</option>}
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Meldinger sendes fra denne gruppens nummer og lagres i gruppens innboks
                </p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="bulk" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="bulk">
                <Users className="h-4 w-4 mr-2" />
                Bulk til gruppe
              </TabsTrigger>
              <TabsTrigger value="single">
                <MessageSquare className="h-4 w-4 mr-2" />
                Enkeltmelding
              </TabsTrigger>
              <TabsTrigger value="group">
                <Users className="h-4 w-4 mr-2" />
                (Gammel) Gruppe
              </TabsTrigger>
              <TabsTrigger value="contacts">
                <User className="h-4 w-4 mr-2" />
                Kontakter
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bulk" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle>Mottakere i {groups.find(g => g.id === selectedGroup)?.name}</CardTitle>
                    <CardDescription>
                      Velg hvilke medlemmer som skal motta meldingen.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center space-x-2 mb-4 pb-4 border-b">
                      <Checkbox 
                        id="select-all" 
                        checked={selectedMembers.length === groupMembers.length && groupMembers.length > 0}
                        onCheckedChange={toggleSelectAllMembers}
                      />
                      <label
                        htmlFor="select-all"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Velg alle ({groupMembers.length})
                      </label>
                    </div>
                    
                    <ScrollArea className="flex-1 h-[400px]">
                      <div className="space-y-2">
                        {groupMembers.length === 0 ? (
                          <div className="text-center text-muted-foreground py-8">
                            Ingen medlemmer med telefonnummer funnet i denne gruppen.
                          </div>
                        ) : (
                          groupMembers.map((member) => (
                            <div key={member.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50">
                              <Checkbox 
                                id={`member-${member.id}`} 
                                checked={selectedMembers.includes(member.id)}
                                onCheckedChange={() => toggleMemberSelection(member.id)}
                              />
                              <div className="grid gap-1.5 leading-none">
                                <label
                                  htmlFor={`member-${member.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {member.full_name}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {member.phone_number}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Utform melding</CardTitle>
                    <CardDescription>
                       Meldingen sendes til {selectedMembers.length} valgte mottakere.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-subject">Emnefelt (vises i innboks)</Label>
                      <Input
                        id="bulk-subject"
                        placeholder="Eks: Vaktliste uke 42"
                        value={bulkSubject}
                        onChange={(e) => setBulkSubject(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Hjelper med å gruppere svar og identifisere samtalen.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bulk-message">Melding</Label>
                      <Textarea
                        id="bulk-message"
                        placeholder="Skriv din melding her..."
                        rows={10}
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                         <span>{messageContent.length} tegn</span>
                         <span>Vil sendes som {Math.ceil(messageContent.length / 160)} SMS</span>
                      </div>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-md text-xs space-y-1">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5" />
                        <span>Alle svar innen 6 timer kobles automatisk til denne kampanjen.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5" />
                        <span>Svar havner i innboksen til <strong>{groups.find(g => g.id === selectedGroup)?.name}</strong>.</span>
                      </div>
                    </div>

                    <Button
                      onClick={handleSendBulk}
                      disabled={loading || selectedMembers.length === 0 || !messageContent || !bulkSubject}
                      className="w-full"
                    >
                      {loading ? (
                        <>Sending...</> 
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send til {selectedMembers.length} mottakere
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="single" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Send til enkeltperson</CardTitle>
                  <CardDescription>
                     Send en melding til ett telefonnummer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="single-phone">Mottakers telefonnummer</Label>
                    <div className="flex gap-2">
                      <Popover open={singleSearchOpen} onOpenChange={setSingleSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={singleSearchOpen}
                            className="w-[180px] justify-between"
                          >
                             <User className="mr-2 h-4 w-4" />
                             Søk kontakt...
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput 
                              placeholder="Søk navn..." 
                              value={singleSearchValue}
                              onValueChange={setSingleSearchValue}
                            />
                            <CommandList>
                              <CommandEmpty>Ingen kontakter funnet.</CommandEmpty>
                              <CommandGroup>
                                {contacts
                                  .filter(contact => 
                                    (contact.name?.toLowerCase() || "").includes(singleSearchValue.toLowerCase()) ||
                                    (contact.phone_number || "").includes(singleSearchValue)
                                  )
                                  .slice(0, 10)
                                  .map((contact) => (
                                    <CommandItem
                                      key={contact.id}
                                      value={contact.phone_number + " " + contact.name}
                                      onSelect={() => {
                                        setRecipientPhone(contact.phone_number);
                                        setSingleSearchOpen(false);
                                        setSingleSearchValue("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          recipientPhone === contact.phone_number ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{contact.name}</span>
                                        <span className="text-sm text-muted-foreground">{contact.phone_number}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      
                      <Input
                        id="single-phone"
                        type="tel"
                        placeholder="+47..."
                        className="flex-1"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                      />
                    </div>
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
                    Send melding til alle medlemmer i en valgt gruppe.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="target-group">Mottaker-gruppe</Label>
                    <div className="p-3 border rounded bg-muted/20 text-sm text-muted-foreground">
                       Velg hvilken gruppe som skal motta meldingen (bruk nedtrekksmenyen øverst for avsender-gruppe).
                       <br/>
                       Dette brukes typisk for interne beskjeder.
                    </div>
                    {/* Reuse global group selector or separate? Ideally explicit target selector */}
                    <select
                      id="target-group"
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      onChange={(e) => {
                         // Logic for target group sending...
                         // For now reusing selectedGroup state might be confusing if we want Source != Target
                         // But in "Send to Group" usually Target is the variable.
                         // Let's rely on the user understanding Source Group (top) vs Target Group (here)
                         // Wait, in handleSendToGroup we use selectedGroup as TARGET and SOURCE?
                         // That's a logic flaw in previous code. 
                         // Correct logic: Source is "Me/My Group". Target is "Recipients".
                         // For simplicity now: We send TO the members of 'selectedGroup'. 
                         // The thread will belong to 'selectedGroup' as well? 
                         // If I send TO 'Cleaning Staff', the thread should belong to 'Cleaning Staff' so they can see it.
                      }}
                      value={selectedGroup} 
                      disabled
                    >
                      <option value={selectedGroup}>
                         {groups.find(g => g.id === selectedGroup)?.name || "Velg gruppe øverst"} (Mottakere)
                      </option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                       Meldingen sendes til alle medlemmer i gruppen valgt øverst.
                    </p>
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
                    </div>

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
        </div>
      </AppLayout>
    </>
  );
}