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
import { Check, Send, Clock, User, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { contactService } from "@/services/contactService";
import { useLanguage } from "@/contexts/LanguageProvider";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

type Gateway = { id: string; name: string; gw_phone: string };
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
  phone: string;
};

export default function SimulatePage() {
  const { t } = useLanguage();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [fromPhone, setFromPhone] = useState<string>("");
  const [messageContent, setMessageContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selectedRecentMessageId, setSelectedRecentMessageId] = useState<string>("");
  const [replyContext, setReplyContext] = useState<string>("");
  
  // Gateway API override (persisted in localStorage)
  const [gatewayOverride, setGatewayOverride] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sim_gateway_override") === "true";
  });

  const toggleGatewayOverride = (val: boolean) => {
    setGatewayOverride(val);
    localStorage.setItem("sim_gateway_override", String(val));
  };

  // Search state
  const [fromSearchOpen, setFromSearchOpen] = useState(false);
  const [fromSearchValue, setFromSearchValue] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1. Fetch Gateways
      const { data: gatewaysData } = await db
        .from("sms_gateways")
        .select("*")
        .eq("is_active", true);
      
      if (gatewaysData) setGateways(gatewaysData);

      // 2. Fetch Groups
      const { data: groupsData } = await db
        .from("groups")
        .select("*, gateway:sms_gateways!groups_gateway_id_fkey(*)")
        .eq("kind", "operational")
        .order("name");
        
      if (groupsData) setGroups(groupsData as any);

      // 3. Fetch Contacts via Service
      const serviceContacts = await contactService.getAllContacts();
        
      if (serviceContacts) {
        setContacts(serviceContacts.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone
        })));
      }

      // 4. Fetch Messages
      const { data: messagesData } = await db
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
        
      if (messagesData) setRecentMessages(messagesData);

    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const normalizePhone = (phone: string) => {
    const normalized = phone.trim().replace(/[\s\-\(\)]/g, "");
    // Only prepend + for numeric strings (phone/short-codes).
    // Alphanumeric sender IDs like "KRAFTVERK" are returned as-is.
    if (/^\+?\d+$/.test(normalized)) {
      return normalized.startsWith("+") ? normalized : `+${normalized}`;
    }
    return normalized;
  };

  const isKnownContactPhone = (phone: string) => {
    const normalizedPhone = normalizePhone(phone);
    return contacts.some((contact) => normalizePhone(contact.phone) === normalizedPhone);
  };

  const handleSelectRecentMessage = (msg: any) => {
    setSelectedRecentMessageId(msg.id);

    const simulatedSender =
      msg.direction === "outbound" ? msg.to_number || "" : msg.from_number || "";

    if (simulatedSender) {
      setFromPhone(simulatedSender);
    }

    setReplyContext(msg.content || "");
  };

  const getConversationPartyNumber = (msg: any) =>
    msg.direction === "outbound" ? msg.to_number || "" : msg.from_number || "";

  const getConversationPartyLabel = (msg: any) => {
    const number = getConversationPartyNumber(msg);
    if (!number) return "Ukjent";

    const contact = contacts.find((c) => normalizePhone(c.phone) === normalizePhone(number));
    return contact?.name || number || t("simulate.unknown");
  };

  const handleSendMessage = async () => {
    if (!fromPhone || !messageContent) {
      toast({
        title: t("simulate.missing_info"),
        description: t("simulate.fill_phone_and_message"),
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
          gatewayPhone = group.gateway?.gw_phone || "";
        }
      }

      if (!gatewayId && gateways.length > 0) {
        gatewayId = gateways[0].id;
        gatewayPhone = gateways[0].gw_phone;
      }

      if (!gatewayId) throw new Error("No active gateway found");

      // Normalize phone numbers
      const phoneWithPlus = normalizePhone(fromPhone);
      const senderIsKnownContact = isKnownContactPhone(fromPhone);
      const effectiveTargetGroupId = senderIsKnownContact ? selectedGroup || null : null;

      // Check if this is a bulk campaign response
      let campaignId: string | null = null;
      let parentMessageId: string | null = null;

      if (effectiveTargetGroupId) {
        console.log("🔍 Checking for bulk campaign in group:", effectiveTargetGroupId);
        
        const { data: campaign, error: campaignError } = await db
          .from("bulk_campaigns")
          .select("id, name")
          .eq("group_id", effectiveTargetGroupId)
          .in("status", ["pending", "sending", "sent"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (campaignError) {
          console.error("Campaign lookup error:", campaignError);
        }

        if (campaign) {
          console.log("✅ Found campaign:", campaign.id, campaign.name);
          
          const { data: parentMsg, error: parentError } = await db
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
          console.log("ℹ️ No active bulk campaign found for group:", effectiveTargetGroupId);
        }
      }

      // FIXED: Send correct field names to Edge Function
      const payload = {
        gateway_id: gatewayId,
        from_number: phoneWithPlus,
        to_number: gatewayPhone,
        content: messageContent,
        received_at: new Date().toISOString(),
        campaign_id: campaignId,
        parent_message_id: parentMessageId,
        target_group_id: effectiveTargetGroupId,
      };

      console.log("📤 Sending to /api/simulate:", payload);

      const { data: { session } } = await db.auth.getSession();
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      console.log("✅ Inbound message processed:", data);

      toast({
        title: t("simulate.message_simulated"),
        description: !senderIsKnownContact
          ? t("simulate.unknown_routing")
          : data.is_bulk_response
          ? t("simulate.bulk_response")
          : data.is_fallback
          ? t("simulate.fallback_routed")
          : t("simulate.message_routed"),
      });
      
      setMessageContent("");
      setReplyContext("");
      setSelectedRecentMessageId("");
      loadData();
    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast({
        title: t("simulate.send_error"),
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

    if (minutes < 1) return t("simulate.just_now");
    if (minutes < 60) return `${minutes} ${t("simulate.min_ago")}`;
    if (hours < 24) return `${hours} ${t("simulate.hours_ago")}`;
    return date.toLocaleDateString("no-NO");
  };

  const selectedGroupData = groups.find((g) => g.id === selectedGroup);
  const gatewayInfo = selectedGroupData?.gateway?.gw_phone
    ? `${t("simulate.gateway_prefix")} ${selectedGroupData.gateway.gw_phone}`
    : t("simulate.auto_gateway");

  return (
    <>
      <Head>
        <title>{t("simulate.title")} – SeMSe</title>
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("simulate.title")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("simulate.description")}
            </p>
          </div>

          {gatewayOverride && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t("simulate.gateway_override_banner")}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  {t("simulate.send_message_card")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <Label htmlFor="gateway-override" className="text-sm cursor-pointer">
                    {t("simulate.gateway_override_label")}
                  </Label>
                  <Switch
                    id="gateway-override"
                    checked={gatewayOverride}
                    onCheckedChange={toggleGatewayOverride}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group">{t("simulate.target_group")}</Label>
                  <select
                    id="group"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    disabled={!isKnownContactPhone(fromPhone)}
                  >
                    <option value="">{t("simulate.auto_routing")}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {isKnownContactPhone(fromPhone)
                      ? gatewayInfo
                      : t("simulate.unknown_routing_note")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("simulate.from_number")}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="+4791234567, KRAFTVERK, 2222 ..."
                      value={fromPhone}
                      onChange={(e) => setFromPhone(e.target.value)}
                      className="flex-1"
                    />
                    <Popover open={fromSearchOpen} onOpenChange={setFromSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          title={t("simulate.search_contact")}
                        >
                          <User className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="end">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder={t("simulate.search_name_or_number")}
                            value={fromSearchValue}
                            onValueChange={setFromSearchValue}
                          />
                          <CommandList>
                            <CommandEmpty>{t("simulate.no_contacts_found")}</CommandEmpty>
                            <CommandGroup>
                              {contacts
                                .filter(contact =>
                                  (contact.name?.toLowerCase() || "").includes(fromSearchValue.toLowerCase()) ||
                                  (contact.phone || "").includes(fromSearchValue)
                                )
                                .slice(0, 10)
                                .map((contact) => (
                                  <CommandItem
                                    key={contact.id}
                                    value={contact.phone + " " + contact.name}
                                    onSelect={() => {
                                      setFromPhone(contact.phone);
                                      setFromSearchOpen(false);
                                      setFromSearchValue("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        fromPhone === contact.phone ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{contact.name}</span>
                                      <span className="text-sm text-muted-foreground">{contact.phone}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("simulate.phone_hint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message-content">{t("simulate.message")}</Label>
                  {replyContext && (
                    <p className="text-xs text-muted-foreground">
                      {t("simulate.reply_to_prefix")} "{replyContext}"
                    </p>
                  )}
                  <Textarea
                    id="message-content"
                    placeholder={t("simulate.message_placeholder")}
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
                  {loading ? t("simulate.sending") : t("simulate.send_button")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t("simulate.recent_messages")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentMessages.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {t("simulate.no_messages")}
                    </p>
                  ) : (
                    recentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectRecentMessage(msg)}
                        className={cn(
                          "p-3 border rounded cursor-pointer hover:border-primary transition-colors",
                          selectedRecentMessageId === msg.id && "border-primary bg-primary/5",
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={msg.direction === "inbound" ? "default" : "secondary"}>
                              {msg.direction === "inbound" ? t("simulate.inbound_badge") : t("simulate.outbound_badge")}
                            </Badge>
                            <span className="text-sm font-medium">{getConversationPartyLabel(msg)}</span>
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
