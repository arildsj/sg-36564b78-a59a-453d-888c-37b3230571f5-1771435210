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
import { toast } from "@/hooks/use-toast";
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
import { Check, Send, Clock, User } from "lucide-react";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Gateway = { id: string; name: string; phone_number: string };
type Group = { 
  id: string; 
  name: string; 
  kind: string;
  gateway_id: string | null;
  gateway?: Gateway;
};
type Contact = {
  id: string;
  name: string;
  phone_number: string;
};

export default function SimulatePage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [fromPhone, setFromPhone] = useState<string>("");
  const [messageContent, setMessageContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  // Search state
  const [fromSearchOpen, setFromSearchOpen] = useState(false);
  const [fromSearchValue, setFromSearchValue] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1. Fetch Gateways
      const { data: gatewaysData } = await supabase
        .from("gateways")
        .select("*")
        .eq("status", "active");
      
      if (gatewaysData) setGateways(gatewaysData);

      // 2. Fetch Groups (simplified query to avoid deep typing issues)
      const { data: groupsData } = await supabase
        .from("groups")
        .select("*, gateway:gateways!groups_gateway_id_fkey(*)")
        .eq("kind", "operational")
        .order("name");
        
      if (groupsData) setGroups(groupsData as any);

      // 3. Fetch Contacts
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*")
        .order("name");
        
      if (contactsData) setContacts(contactsData);

      // 4. Fetch Messages
      const { data: messagesData } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
        
      if (messagesData) setRecentMessages(messagesData);

      // Set defaults
      if (groupsData && groupsData.length > 0 && !selectedGroup) {
        setSelectedGroup(groupsData[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleSendMessage = async () => {
    // Validering: Tillat sending hvis gruppe er valgt ELLER hvis systemet skal route automatisk (ingen gruppe valgt)
    // Men for simulering er det best å være eksplisitt, men fallback-logikken støtter automatikk.
    // Vi krever nummer og innhold.
    if (!fromPhone || !messageContent) {
      toast({
        title: "Mangler informasjon",
        description: "Fyll ut fra-nummer og melding",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Clean phone number
      const cleanFromNumber = formatPhoneNumber(fromPhone);

      // Get user context for tenant_id
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("users")
        .select("id, tenant_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      // Get Gateway
      // Logic: If group selected, use group's gateway. If not, use first active gateway.
      let gatewayId: string | null = null;
      let gatewayPhone: string = "";

      if (selectedGroup) {
        const group = groups.find(g => g.id === selectedGroup);
        if (group?.gateway_id) {
          gatewayId = group.gateway_id;
          gatewayPhone = group.gateway?.phone_number || "";
        }
      }

      if (!gatewayId && gateways.length > 0) {
        gatewayId = gateways[0].id;
        gatewayPhone = gateways[0].phone_number;
      }

      if (!gatewayId) throw new Error("No active gateway found");

      // Find or Create Thread (One per contact phone)
      const { data: existingThread } = await supabase
        .from("message_threads")
        .select("id")
        .eq("tenant_id", profile.tenant_id)
        .eq("contact_phone", cleanFromNumber)
        .maybeSingle();

      let threadId: string;

      if (!existingThread) {
        const { data: newThread, error: threadError } = await supabase
          .from("message_threads")
          .insert({
            tenant_id: profile.tenant_id,
            gateway_id: gatewayId,
            contact_phone: cleanFromNumber,
            resolved_group_id: selectedGroup || null, // If explicit group selected, set it. If null, routing logic will handle later? 
            // NOTE: In manual simulation, we want to force the group if selected.
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (threadError) throw threadError;
        threadId = newThread.id;
      } else {
        threadId = existingThread.id;
        // Update thread to point to this group (Simulating that the message "hit" this group)
        if (selectedGroup) {
            await supabase
            .from("message_threads")
            .update({ 
                resolved_group_id: selectedGroup,
                last_message_at: new Date().toISOString() 
            })
            .eq("id", threadId);
        }
      }

      // Insert Message
      const { error: messageError } = await supabase.from("messages").insert({
        tenant_id: profile.tenant_id,
        gateway_id: gatewayId,
        group_id: selectedGroup || null, // Null means routing rules will pick it up (if backend trigger exists) or it stays null/fallback
        thread_id: threadId,
        thread_key: cleanFromNumber,
        direction: "inbound",
        from_number: cleanFromNumber,
        to_number: gatewayPhone,
        content: messageContent,
        status: "delivered", // Simulated inbound messages are "delivered" to us
      });

      if (messageError) throw messageError;

      toast({
        title: "Melding simulert",
        description: "Meldingen er lagt i innboksen",
      });
      setMessageContent("");
      loadData(); // Refresh list
    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast({
        title: "Feil ved sending",
        description: error.message,
        variant: "destructive",
      });
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
  const gatewayInfo = selectedGroupData?.gateway?.phone_number 
    ? `Gateway: ${selectedGroupData.gateway.phone_number}`
    : "Automatisk valg av gateway";

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
                  <Label htmlFor="group">Målgruppe (valgfritt)</Label>
                  <select
                    id="group"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                  >
                    <option value="">-- Automatisk routing (ingen gruppe valgt) --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {gatewayInfo}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Fra-nummer (avsender)</Label>
                  <div className="flex gap-2">
                    <Popover open={fromSearchOpen} onOpenChange={setFromSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={fromSearchOpen}
                          className="w-full justify-between"
                        >
                           <User className="mr-2 h-4 w-4" />
                           Søk kontakt...
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Søk navn eller nummer..." 
                            value={fromSearchValue}
                            onValueChange={setFromSearchValue}
                          />
                          <CommandList>
                            <CommandEmpty>Ingen kontakter funnet.</CommandEmpty>
                            <CommandGroup>
                              {contacts
                                .filter(contact => 
                                  contact.name.toLowerCase().includes(fromSearchValue.toLowerCase()) ||
                                  contact.phone_number.includes(fromSearchValue)
                                )
                                .slice(0, 10) // Limit results for performance
                                .map((contact) => (
                                  <CommandItem
                                    key={contact.id}
                                    value={contact.phone_number + " " + contact.name} // Include name in value for search matching
                                    onSelect={() => {
                                      setFromPhone(contact.phone_number);
                                      setFromSearchOpen(false);
                                      setFromSearchValue("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        fromPhone === contact.phone_number ? "opacity-100" : "opacity-0"
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
                    </div>
                    
                    <Input
                      type="tel"
                      placeholder="+47..."
                      value={fromPhone}
                      onChange={(e) => setFromPhone(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Søk opp kontakt eller skriv nummer direkte i feltet til høyre
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
                  disabled={loading}
                >
                  {loading ? "Sender..." : "Send inn melding"}
                </Button>
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
                      Ingen meldinger ennå.
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
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </>
  );
}