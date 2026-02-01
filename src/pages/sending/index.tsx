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
import { useToast } from "@/hooks/use-toast";

export default function SendingPage() {
  const { toast } = useToast();
  const [recipientType, setRecipientType] = useState<"single" | "group">("single");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [message, setMessage] = useState("");
  const [groups, setGroups] = useState<{id: string, name: string}[]>([]);
  const [groupContacts, setGroupContacts] = useState<{phone_number: string, description: string | null}[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [searching, setSearching] = useState(false);

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

  const handleSearchContacts = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      console.log("🔍 Searching for contacts with query:", query);
      
      // Try user-access-filtered search first
      let results = await contactService.getContactsByUserAccess();
      console.log("📋 Fetched contacts by user access:", results);
      
      // If no results from access-based search, try direct search as fallback
      if (!results || results.length === 0) {
        console.log("⚠️ No contacts from user access, trying direct search...");
        results = await contactService.searchContacts(query);
        console.log("📋 Fetched contacts from direct search:", results);
      }
      
      // Filter results based on search query (case-insensitive)
      const queryLower = query.toLowerCase();
      const filtered = results.filter((c: any) => {
        const nameMatch = c.name?.toLowerCase().includes(queryLower);
        const phoneMatch = c.phone?.toLowerCase().includes(queryLower) || 
                          c.phone?.replace(/\s+/g, '').includes(queryLower.replace(/\s+/g, ''));
        console.log(`   Checking ${c.name} (${c.phone}): name=${nameMatch}, phone=${phoneMatch}`);
        return nameMatch || phoneMatch;
      });
      
      console.log("✅ Filtered results:", filtered);
      setSearchResults(filtered.slice(0, 10));
      
      if (filtered.length === 0) {
        console.log("⚠️ No results matched your search query");
      }
    } catch (error) {
      console.error("❌ Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectContact = (contact: any) => {
    setSelectedContact(contact);
    setPhoneNumber(contact.phone);
    setSearchQuery(contact.name);
    setSearchResults([]);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: "Mangler melding",
        description: "Vennligst skriv en melding",
        variant: "destructive",
      });
      return;
    }
    
    if (recipientType === "single" && !phoneNumber.trim()) {
      toast({
        title: "Mangler mottaker",
        description: "Vennligst velg en kontakt eller skriv inn telefonnummer",
        variant: "destructive",
      });
      return;
    }
    
    if (recipientType === "group" && !selectedGroup) {
      toast({
        title: "Mangler gruppe",
        description: "Vennligst velg en gruppe",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);

      if (recipientType === "single") {
        // Send to single recipient (thread will be created automatically)
        await messageService.sendMessage(
          message,
          phoneNumber,
          "+4790000000" // Default sender (should come from gateway)
        );
        
        toast({
          title: "Melding sendt!",
          description: `Sendt til ${selectedContact?.name || phoneNumber}`,
        });
        
        setMessage("");
        setPhoneNumber("");
        setSelectedContact(null);
        setSearchQuery("");
      } else {
        // Bulk send to group contacts
        if (groupContacts.length === 0) {
          toast({
            title: "Ingen kontakter",
            description: "Ingen kontakter funnet i denne gruppen",
            variant: "destructive",
          });
          return;
        }

        // Send to all contacts in the group
        const sendPromises = groupContacts.map(contact =>
          messageService.sendMessage(
            message,
            contact.phone_number,
            "+4790000000" // Default sender
          )
        );

        await Promise.all(sendPromises);
        
        toast({
          title: "Melding sendt!",
          description: `Sendt til ${groupContacts.length} kontakter i gruppen`,
        });
        
        setMessage("");
        setSelectedGroup("");
      }
    } catch (error: any) {
      console.error("Failed to send:", error);
      toast({
        title: "Feil ved sending",
        description: error.message || "Kunne ikke sende melding",
        variant: "destructive",
      });
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
                  <Label htmlFor="contact-search">Søk etter kontakt</Label>
                  <div className="relative">
                    <Input
                      id="contact-search"
                      placeholder="Søk på navn eller telefonnummer..."
                      value={searchQuery}
                      onChange={(e) => handleSearchContacts(e.target.value)}
                      onFocus={() => {
                        if (searchQuery.length >= 2) {
                          handleSearchContacts(searchQuery);
                        }
                      }}
                    />
                    {searching && (
                      <div className="absolute right-3 top-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-b-0"
                            onClick={() => handleSelectContact(contact)}
                          >
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-sm text-muted-foreground">{contact.phone}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {selectedContact && (
                    <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-md border">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{selectedContact.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedContact(null);
                          setPhoneNumber("");
                          setSearchQuery("");
                        }}
                      >
                        Fjern
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Eller skriv inn telefonnummer direkte (f.eks. +47 123 45 678)
                  </p>
                  <Input
                    placeholder="+47 123 45 678"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      setSelectedContact(null);
                      setSearchQuery("");
                    }}
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