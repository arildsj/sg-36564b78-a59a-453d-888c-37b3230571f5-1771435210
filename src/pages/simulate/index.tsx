import React, { useState, useEffect } from "react";
import Head from "next/head";
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
import { contactService } from "@/services/contactService";

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

      // 2. Fetch Groups
      const { data: groupsData } = await supabase
        .from("groups")
        .select("*, gateway:gateways!groups_gateway_id_fkey(*)")
        .eq("kind", "operational")
        .order("name");
        
      if (groupsData) setGroups(groupsData as any);

      // 3. Fetch Contacts via Service
      const serviceContacts = await contactService.getAllContacts();
        
      if (serviceContacts) {
        setContacts(serviceContacts.map(c => ({
          id: c.id,
          name: c.name,
          phone_number: c.phone
        })));
      }

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
      // Get gateway info
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

      // NEW: Check if this is a bulk campaign response
      let campaignId: string | null = null;
      let parentMessageId: string | null = null;

      if (selectedGroup) {
        console.log("🔍 Checking for bulk campaign in group:", selectedGroup);
        
        // Find latest bulk campaign for this group
        const { data: campaign, error: campaignError } = await supabase
          .from("bulk_campaigns")
          .select("id, name")
          .eq("source_group_id", selectedGroup)
          .in("status", ["pending", "sending", "sent"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (campaignError) {
          console.error("Campaign lookup error:", campaignError);
        }

        if (campaign) {
          console.log("✅ Found campaign:", campaign.id, campaign.name);
          
          // Find the outbound message sent to this number
          const normalizedFrom = fromPhone.trim().replace(/[\s\-\(\)]/g, "");
          const phoneWithPlus = normalizedFrom.startsWith("+") ? normalizedFrom : `+${normalizedFrom}`;
          
          const { data: parentMsg, error: parentError } = await supabase
            .from("messages")
            .select("id")
            .eq("campaign_id", campaign.id)
            .eq("to_number", phoneWithPlus)
            .eq("direction", "outbound")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (parentError) {
            console.error("Parent message lookup error:", parentError);
          }

          if (parentMsg) {
            console.log("✅ Found parent message:", parentMsg.id);
            campaignId = campaign.id;
            parentMessageId = parentMsg.id;
          } else {
            console.warn("⚠️ No outbound message found to", phoneWithPlus, "in campaign", campaign.id);
          }
        } else {
          console.log("ℹ️ No active bulk campaign found for group:", selectedGroup);
        }
      }

      console.log("📤 Sending to inbound-message:", {
        from: fromPhone.trim(),
        to: gatewayPhone,
        gateway: gatewayId,
        campaign_id: campaignId,
        parent_message_id: parentMessageId
      });

      // Call inbound-message Edge Function to simulate incoming message
      const { data, error } = await supabase.functions.invoke("inbound-message", {
        body: {
          gateway_id: gatewayId,
          from_number: fromPhone.trim(),
          to_number: gatewayPhone,
          content: messageContent,
          received_at: new Date().toISOString(),
          campaign_id: campaignId,
          parent_message_id: parentMessageId,
        },
      });

      if (error) throw error;

      console.log("✅ Inbound message processed:", data);

      toast({
        title: "Melding simulert",
        description: data.is_bulk_response 
          ? "Bulk-kampanje-svar mottatt"
          : data.is_fallback 
          ? "Melding rutet til fallback-gruppe" 
          : "Melding rutet basert på regler",
      });
      
      setMessageContent("");
      loadData();
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Popover open={fromSearchOpen} onOpenChange={setFromSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={fromSearchOpen}
                          className="w-full justify-between h-12"
                        >
                           {fromPhone ? (
                             <span className="truncate">{fromPhone}</span>
                           ) : (
                             <>
                               <User className="mr-2 h-4 w-4" />
                               <span>Søk kontakt...</span>
                             </>
                           )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[300px] p-0" align="start">
                        <Command shouldFilter={false}>
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
                                  (contact.name?.toLowerCase() || "").includes(fromSearchValue.toLowerCase()) ||
                                  (contact.phone_number || "").includes(fromSearchValue)
                                )
                                .slice(0, 10)
                                .map((contact) => (
                                  <CommandItem
                                    key={contact.id}
                                    value={contact.phone_number + " " + contact.name}
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
                    </Popover>
                    
                    <Input
                      type="tel"
                      placeholder="+47..."
                      value={fromPhone}
                      onChange={(e) => setFromPhone(e.target.value)}
                      className="w-[180px]"
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