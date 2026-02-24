import React, { useEffect, useState, useRef } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Clock,
  CheckCheck,
  Check,
  Inbox as InboxIcon,
  AlertTriangle,
  FolderInput,
  Archive,
  ArrowRight,
  ArrowLeft,
  Users,
  PlayCircle,
  Mail,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  messageService, 
  type Message, 
  type MessageFilter,
  type ExtendedMessageThread
} from "@/services/messageService";
import { groupService, type Group } from "@/services/groupService";
import { bulkService, type BulkRecipient } from "@/services/bulkService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageProvider";

// Hjelpefunksjon for datoformatering
const formatMessageTime = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && 
                      date.getMonth() === yesterday.getMonth() && 
                      date.getFullYear() === yesterday.getFullYear();

  const timeStr = new Intl.DateTimeFormat("no-NO", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

  if (isToday) {
    return `I dag ${timeStr}`;
  }
  
  if (isYesterday) {
    return `I går ${timeStr}`;
  }
  
  return new Intl.DateTimeFormat("no-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export default function InboxPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"all" | "fallback" | "escalated">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [threads, setThreads] = useState<ExtendedMessageThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Bulk view state
  const [bulkRecipients, setBulkRecipients] = useState<BulkRecipient[]>([]);
  const [bulkResponses, setBulkResponses] = useState<any[]>([]);
  const [bulkReminders, setBulkReminders] = useState<any[]>([]);
  const [bulkTab, setBulkTab] = useState<"responses" | "status">("responses");
  const [selectedForReminder, setSelectedForReminder] = useState<string[]>([]);

  // Helper: Check if recipient has received a reminder
  const hasReceivedReminder = (recipientPhone: string) => {
    return bulkReminders.find((r: any) => r.to_number === recipientPhone);
  };

  // Simulation dialog state
  const [simulateDialogOpen, setSimulateDialogOpen] = useState(false);
  const [selectedRecipientForSim, setSelectedRecipientForSim] = useState<string>("");
  const [simulatedMessage, setSimulatedMessage] = useState("");
  const [sendingSimulation, setSendingSimulation] = useState(false);

  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const [sendingProgress, setSendingProgress] = useState({ sent: 0, total: 0 });
  
  // Restored missing state variables
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [reclassifyDialogOpen, setReclassifyDialogOpen] = useState(false);
  const [reclassifyTargetGroup, setReclassifyTargetGroup] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  // Filter threads based on search query and filters
  const filteredThreads = threads.filter((thread) => {
    const matchesSearch = 
      thread.contact_phone.includes(searchQuery) || 
      (thread.group_name && thread.group_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (thread.last_message_content && thread.last_message_content.toLowerCase().includes(searchQuery.toLowerCase()));
      
    // Filter by view mode (Tabs)
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "fallback") return matchesSearch && thread.is_fallback;
    if (activeTab === "escalated") return matchesSearch; // Escalated logic handled in loadThreads
    
    return matchesSearch;
  });

  useEffect(() => {
    loadGroups();
    loadThreads();

    const channel = db
      .channel("inbox_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadThreads();
          if (selectedThreadId) {
            loadMessages(selectedThreadId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_threads" },
        () => {
          loadThreads();
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [activeTab, selectedGroupFilter]);

  useEffect(() => {
    if (selectedThreadId) {
      loadMessages(selectedThreadId);
    }
  }, [selectedThreadId]);

  const loadGroups = async () => {
    try {
      const allGroups = await groupService.getOperationalGroups();
      setGroups(allGroups);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const loadThreads = async () => {
    try {
      setLoading(true);
      let loadedThreads: ExtendedMessageThread[] = [];

      if (activeTab === "all") {
        loadedThreads = await messageService.getInboxThreads();
      } else if (activeTab === "fallback") {
        loadedThreads = await messageService.getFallbackThreads();
      } else if (activeTab === "escalated") {
        loadedThreads = await messageService.getEscalatedThreads(30);
      }

      if (selectedGroupFilter !== "all") {
        loadedThreads = loadedThreads.filter(
          (t) => t.resolved_group_id === selectedGroupFilter
        );
      }

      setThreads(loadedThreads);

      // Auto-select first thread if none selected
      if (loadedThreads.length > 0) {
        if (!selectedThreadId || !loadedThreads.find(t => t.id === selectedThreadId)) {
          setSelectedThreadId(loadedThreads[0].id);
        }
      } else {
        setSelectedThreadId(null);
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    
    if (thread?.is_bulk) {
      // LOAD BULK DATA
      try {
        const details = await bulkService.getCampaignDetails(threadId);
        setBulkRecipients(details.recipients);

        // Fetch inbound responses
        const { data: responses } = await db
          .from("messages")
          .select("*")
          .eq("campaign_id", threadId)
          .eq("direction", "inbound")
          .order("created_at", { ascending: true });
          
        setBulkResponses((responses as any) || []);

        // Fetch outbound reminders separately
        const { data: reminders } = await db
          .from("messages")
          .select("*")
          .eq("campaign_id", threadId)
          .eq("direction", "outbound")
          .order("created_at", { ascending: true });
          
        setBulkReminders((reminders as any) || []);
      } catch (error) {
        console.error("Failed to load bulk details:", error);
      }
      return;
    }

    // STANDARD THREAD LOADING
    try {
      const threadMessages = await messageService.getMessagesByThread(threadId);
      
      threadMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setMessages(threadMessages);
      
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleSendReply = async () => {
    if (!newMessage.trim() || !selectedThread) return;

    try {
      setSending(true);

      await messageService.sendMessage(
        newMessage,
        selectedThread.contact_phone,
        "+47 900 00 000",
        selectedThread.id,
        selectedThread.resolved_group_id || undefined
      );

      setNewMessage("");
      toast({
        title: "Melding sendt",
        description: "Svaret ditt er sendt",
      });
    } catch (error) {
      console.error("Failed to send reply:", error);
      toast({
        title: "Feil ved sending",
        description: "Kunne ikke sende melding",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedThread) return;

    try {
      await messageService.acknowledgeThread(selectedThread.id);
      await loadThreads();
      toast({
        title: "Tråd bekreftet",
        description: "Alle meldinger i tråden er markert som lest",
      });
    } catch (error) {
      console.error("Failed to acknowledge thread:", error);
    }
  };

  const handleReclassify = async () => {
    if (!selectedThread || !reclassifyTargetGroup) return;

    try {
      await messageService.reclassifyThread(selectedThread.id, reclassifyTargetGroup);
      
      setReclassifyDialogOpen(false);
      setReclassifyTargetGroup("");
      await loadThreads();
      toast({
        title: "Samtale flyttet",
        description: "Samtalen er flyttet til ny gruppe",
      });
    } catch (error) {
      console.error("Failed to reclassify thread:", error);
      toast({
        title: "Feil ved flytting",
        description: "Kunne ikke omklassifisere samtale",
        variant: "destructive",
      });
    }
  };

  const handleResolve = async () => {
    if (!selectedThread) return;

    try {
      await messageService.resolveThread(selectedThread.id);
      setSelectedThreadId(null);
      await loadThreads();
      toast({
        title: "Samtale løst",
        description: "Samtalen er markert som løst",
      });
    } catch (error) {
      console.error("Failed to resolve thread:", error);
      toast({
        title: "Feil ved løsing",
        description: "Kunne ikke løse samtale",
        variant: "destructive",
      });
    }
  };

  const handleSimulateResponse = async () => {
    if (!selectedRecipientForSim || !simulatedMessage.trim()) return;

    setSendingSimulation(true);
    try {
      // Get the recipient object from the ID
      const recipient = bulkRecipients.find(r => r.id === selectedRecipientForSim);
      if (!recipient) {
        throw new Error("Mottaker ikke funnet");
      }

      // Normalize phone number
      const normalizedPhone = recipient.phone_number.replace(/[\s\-\(\)]/g, "");
      
      // Check if it's alphanumeric (1-11 chars) or numeric E.164
      const isAlphanumeric = /^[A-Za-z0-9]{1,11}$/.test(normalizedPhone);
      const phoneWithPlus = isAlphanumeric 
        ? normalizedPhone  // Keep alphanumeric as-is (e.g., "Dalanekraft")
        : (normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`);
      
      // Validate format
      if (!isAlphanumeric && !/^\+[0-9]{8,15}$/.test(phoneWithPlus)) {
        toast({
          title: "Ugyldig telefonnummer",
          description: "Telefonnummeret må være enten alfanumerisk (1-11 tegn) eller E.164-format (+XXXXXXXXXXX)",
          variant: "destructive",
        });
        return;
      }

      // Get current user for tenant_id
      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        throw new Error("Du må være logget inn");
      }

      // Fetch tenant_id from users table
      const { data: userData } = await db
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      
      const tenantId = userData?.tenant_id;
      if (!tenantId) throw new Error("Tenant ID not found");

      // Get campaign to find source_group_id
      // selectedThread represents the campaign in this view
      const campaignId = selectedThread?.id;
      
      const { data: campaign } = await db
        .from("bulk_campaigns")
        .select("source_group_id")
        .eq("id", campaignId)
        .maybeSingle();

      // Determine group_id (prefer campaign's source_group_id, fallback to user's first group)
      let groupId = campaign?.source_group_id;
      // Use 'groups' state variable instead of undefined 'userGroups'
      if (!groupId && groups && groups.length > 0) {
        groupId = groups[0].id;
      }

      if (!groupId) {
        toast({
          title: "Feil",
          description: "Kunne ikke finne gruppe-ID",
          variant: "destructive",
        });
        return;
      }

      // Fetch a valid gateway ID for the tenant
      const { data: gateway } = await db
        .from("gateways")
        .select("id, phone_number")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      // If no specific gateway found, try to find any gateway or handle error
      // Ideally we need a gateway_id to create a thread.
      // If we are in a simulation context, maybe we can fetch the gateway from the group if linked, but schema says group has gateway_id too?
      // Group schema: gateway_id (nullable). Let's check group first.
      
      let gatewayId = gateway?.id;
      let systemPhoneNumber = gateway?.phone_number || "+4790000000"; // Fallback

      // Check if group has specific gateway
      if (groupId) {
        const selectedGroup = groups.find(g => g.id === groupId);
        if (selectedGroup?.gateway_id) { // This property might not be in the loaded group object if not selected, but let's assume standard group fetch might include it or we query it. 
           // Simpler: just use the tenant gateway found above to ensure it works.
        }
      }

      if (!gatewayId) {
         // If absolutely no gateway found, we might struggle inserting into message_threads as gateway_id is NOT NULL.
         // Let's try to fetch ANY gateway for the system if tenant lookup failed (e.g. dev env)
         // or just throw error.
         // For now, let's assume the previous fetch worked or user has at least one gateway.
         // If not, we can't create a thread.
         if (!gateway) {
            // Try one more fallback: fetch ANY gateway
            const { data: anyGateway } = await db.from("gateways").select("id, phone_number").limit(1).maybeSingle();
            if (anyGateway) {
                gatewayId = anyGateway.id;
                systemPhoneNumber = anyGateway.phone_number;
            } else {
                 throw new Error("Ingen gateway funnet. Kan ikke opprette samtale.");
            }
         }
      }

      // Check if thread exists for this contact
      const { data: existingThread } = await db
        .from("message_threads")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("contact_phone", phoneWithPlus)
        .eq("resolved_group_id", groupId)
        .maybeSingle();

      let threadId = existingThread?.id;

      // Create thread if it doesn't exist
      if (!threadId) {
        // Note: Removed contact_name as it caused type errors
        const { data: newThread, error: threadError } = await db
          .from("message_threads")
          .insert({
            contact_phone: phoneWithPlus,
            last_message_at: new Date().toISOString(),
            is_resolved: false,
            resolved_group_id: groupId,
            gateway_id: gatewayId,
            tenant_id: tenantId
          })
          .select()
          .single();

        if (threadError) throw threadError;
        threadId = newThread.id;
      }

      // Create the simulated inbound message
      const { data: newMessage, error: messageError } = await db
        .from("messages")
        .insert({
          thread_key: phoneWithPlus,
          direction: "inbound",
          from_number: phoneWithPlus,
          to_number: systemPhoneNumber,
          content: simulatedMessage,
          group_id: groupId,
          thread_id: threadId,
          campaign_id: campaignId,
          tenant_id: tenantId
        })
        .select()
        .single();

      if (messageError) {
        throw messageError;
      }

      // Update bulk_recipient with response info
      const { error: updateError } = await db
        .from("bulk_recipients")
        .update({
          responded_at: new Date().toISOString(),
          response_message_id: newMessage.id,
        })
        .eq("id", recipient.id);

      if (updateError) throw updateError;

      toast({
        title: "Svar simulert",
        description: `Simulert svar fra ${recipient.metadata?.name || recipient.phone_number}`,
      });

      // Refresh data
      if (selectedThread) {
        await loadMessages(selectedThread.id);
      }
      
      // Close dialog and reset
      setSimulateDialogOpen(false);
      setSelectedRecipientForSim("");
      setSimulatedMessage("");
    } catch (error: any) {
      console.error("Error simulating response:", error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke simulere svar",
        variant: "destructive",
      });
    } finally {
      setSendingSimulation(false);
    }
  };

  const handleSendReminder = async () => {
    if (selectedForReminder.length === 0 || !reminderMessage.trim()) return;

    setSending(true);
    setSendingProgress({ sent: 0, total: selectedForReminder.length });
    
    try {
      const recipientsToSend = bulkRecipients.filter(r => selectedForReminder.includes(r.id));
      const { data: { user } } = await db.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      // Fetch tenant_id
      const { data: userData } = await db
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      
      const tenantId = userData?.tenant_id;
      if (!tenantId) throw new Error("Tenant ID not found");

      // Get campaign info
      const { data: campaign } = await db
        .from("bulk_campaigns")
        .select("source_group_id")
        .eq("id", selectedThreadId)
        .single();
        
      if (!campaign) throw new Error("Campaign not found");

      let fromNumber = "System";
      let gatewayId: string | null = null;
      
      if (campaign.source_group_id) {
        // First try to get gateway from source group
        const { data: group } = await db
          .from("groups")
          .select("gateway_id")
          .eq("id", campaign.source_group_id)
          .single();
          
        if (group?.gateway_id) {
            gatewayId = group.gateway_id;
            const { data: gateway } = await db
                .from("sms_gateways")
                .select("phone_number")
                .eq("id", group.gateway_id)
                .single();
            if (gateway) fromNumber = gateway.phone_number;
        }
      }

      if (!gatewayId) {
          // Fallback to default gateway if group has none
           const { data: defaultGateway } = await db
            .from("sms_gateways")
            .select("id, phone_number")
            .eq("tenant_id", tenantId)
            .eq("is_default", true)
            .maybeSingle();
            
           if (defaultGateway) {
               gatewayId = defaultGateway.id;
               fromNumber = defaultGateway.phone_number;
           }
      }
      
      // Fallback to ANY gateway if still missing
      if (!gatewayId) {
           const { data: anyGateway } = await db
            .from("sms_gateways")
            .select("id, phone_number")
            .eq("tenant_id", tenantId)
            .limit(1)
            .maybeSingle();

           if (anyGateway) {
               gatewayId = anyGateway.id;
               fromNumber = anyGateway.phone_number;
           } else {
               throw new Error("Ingen gateway funnet. Kan ikke sende melding.");
           }
      }

      const updates = recipientsToSend.map(async (recipient) => {
        // Create outbound reminder message
        const { error: msgError } = await db.from("messages").insert({
          tenant_id: tenantId,
          thread_key: recipient.phone_number,
          direction: "outbound",
          from_number: fromNumber,
          to_number: recipient.phone_number,
          content: reminderMessage,
          campaign_id: selectedThreadId,
          thread_id: null,
          status: "pending",
          is_fallback: false
        });

        if (msgError) throw msgError;
        
        // Increment progress
        setSendingProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
      });
      
      await Promise.all(updates);
      
      toast({
        title: "Påminnelser sendt",
        description: `Sendte påminnelse til ${recipientsToSend.length} mottakere.`
      });
      
      setReminderDialogOpen(false);
      setReminderMessage("");
      setSelectedForReminder([]);
      
    } catch (error) {
      console.error("Error sending reminders:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke sende påminnelser.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const hasUnacknowledged = messages.some((m) => m.direction === "inbound" && !m.is_acknowledged);

  return (
    <>
      <Head>
        <title>{t("inbox.title")} | SeMSe</title>
        <meta name="description" content={t("inbox.description")} />
      </Head>

      <AppLayout>
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
          <div className="flex-none">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("inbox.title")}</h2>
            <p className="text-muted-foreground mt-2">
              {t("inbox.description")}
            </p>
          </div>

          <Tabs 
            value={activeTab} 
            onValueChange={(v: any) => setActiveTab(v)} 
            className="flex-1 flex flex-col space-y-4 min-h-0"
          >
            <div className="flex-none flex items-center justify-between flex-wrap gap-4">
              <TabsList>
                <TabsTrigger value="all" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t("inbox.all_conversations")}
                </TabsTrigger>
                <TabsTrigger value="fallback" className="gap-2">
                  <FolderInput className="h-4 w-4" />
                  {t("inbox.unknown_senders")}
                </TabsTrigger>
                <TabsTrigger value="escalated" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t("inbox.escalated")}
                </TabsTrigger>
              </TabsList>

              <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder={t("inbox.filter_by_group")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("inbox.all_groups")}</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value={activeTab} className="flex-1 m-0 min-h-0 overflow-hidden flex flex-col">
              <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6 h-full">
                {/* Thread List - Full width on mobile */}
                <Card className="lg:col-span-1 flex flex-col h-[400px] lg:h-full overflow-hidden">
                  <CardHeader className="border-b py-3 px-3 lg:px-4 flex-none">
                    <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      {t("inbox.conversations")} ({filteredThreads.length})
                    </CardTitle>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <div className="p-2 lg:p-3 space-y-2">
                      {loading ? (
                        <p className="text-muted-foreground text-center py-8 text-sm">{t("inbox.loading")}</p>
                      ) : filteredThreads.length === 0 && searchQuery === "" ? (
                        <div className="text-center py-8 lg:py-12 px-4">
                          <InboxIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
                          <p className="text-sm">{t("inbox.no_conversations")}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {activeTab === "fallback"
                              ? t("inbox.no_unknown_senders")
                              : activeTab === "escalated"
                              ? t("inbox.no_escalated")
                              : t("inbox.messages_appear_here")}
                          </p>
                        </div>
                      ) : filteredThreads.length === 0 ? (
                        <div className="text-center py-8 lg:py-12">
                          <p className="text-muted-foreground text-sm">{t("inbox.no_conversations_found")}</p>
                        </div>
                      ) : (
                        filteredThreads.map((thread) => (
                          <button
                            key={thread.id}
                            onClick={() => setSelectedThreadId(thread.id)}
                            className={cn(
                              "w-full text-left p-2.5 lg:p-3 rounded-lg border transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                              selectedThreadId === thread.id
                                ? "bg-primary/5 border-primary/50 shadow-sm"
                                : "bg-card hover:bg-accent/50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {thread.is_bulk ? (
                                    <>
                                      <span className="font-semibold text-sm truncate text-primary">
                                        {thread.subject_line || t("inbox.bulk_no_subject")}
                                      </span>
                                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                        {t("inbox.bulk")}
                                      </Badge>
                                      {thread.recipient_stats && (
                                        <span className="text-[10px] text-muted-foreground ml-auto">
                                          {thread.recipient_stats.responded}/{thread.recipient_stats.total} {t("inbox.replies")}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-semibold text-sm truncate">{thread.contact_phone}</span>
                                      {(thread.unread_count || 0) > 0 && (
                                        <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                          {thread.unread_count}
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                  
                                  {thread.is_fallback && !thread.is_bulk && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 border-yellow-500 text-yellow-600">
                                      {t("inbox.unknown")}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal bg-muted">
                                    {thread.group_name}
                                  </Badge>
                                  <span className="flex items-center gap-1 ml-auto">
                                    <Clock className="h-3 w-3" />
                                    {formatMessageTime(thread.last_message_at || "")}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate line-clamp-1">
                                  {thread.last_message_content}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </Card>

                {/* Message Thread View - Full width on mobile when selected */}
                <Card className="lg:col-span-2 flex flex-col h-[600px] lg:h-full overflow-hidden">
                  {selectedThread ? (
                    selectedThread.is_bulk ? (
                      // === BULK CAMPAIGN DETAIL VIEW ===
                      <>
                        <CardHeader className="border-b py-3 px-6 flex-none bg-blue-50/50 dark:bg-blue-900/10">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">{t("inbox.bulk_campaign")}</Badge>
                                <span className="text-xs text-muted-foreground font-mono">ID: {selectedThread.id.slice(0, 8)}</span>
                              </div>
                              <CardTitle className="text-xl mt-2 mb-1">
                                {selectedThread.subject_line || t("inbox.no_subject")}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground max-w-2xl line-clamp-2">
                                {selectedThread.last_message_content}
                              </p>
                            </div>
                            <div className="text-right">
                               <div className="text-2xl font-bold">
                                 {selectedThread.recipient_stats?.responded || 0} / {selectedThread.recipient_stats?.total || 0}
                               </div>
                               <div className="text-xs text-muted-foreground">{t("inbox.have_replied")}</div>
                               <Button 
                                 size="sm" 
                                 variant="outline" 
                                 className="mt-2 gap-2"
                                 onClick={() => setSimulateDialogOpen(true)}
                               >
                                 <Users className="h-4 w-4" />
                                 {t("inbox.simulate_response")}
                               </Button>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <Tabs value={bulkTab} onValueChange={(v) => setBulkTab(v as any)}>
                          <TabsList className="mb-2">
                            <TabsTrigger value="responses">
                              {t("inbox.incoming_replies")} ({bulkResponses.length})
                            </TabsTrigger>
                            <TabsTrigger value="status">
                              {t("inbox.recipient_status_reminder")}
                              {bulkReminders.length > 0 && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                  {bulkReminders.length} {t("inbox.reminder")}{bulkReminders.length !== 1 ? "r" : ""}
                                </Badge>
                              )}
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="responses" className="flex-1 p-0 m-0 overflow-hidden flex flex-col">
                             <ScrollArea className="flex-1">
                               <div className="p-6 space-y-4">
                                 {bulkResponses.length === 0 ? (
                                   <div className="text-center py-12">
                                     <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                                     <h3 className="text-lg font-medium text-muted-foreground">{t("inbox.no_replies_yet")}</h3>
                                     <p className="text-sm text-muted-foreground mt-1">{t("inbox.replies_appear_here")}</p>
                                   </div>
                                 ) : (
                                   bulkResponses.map(msg => (
                                     <div key={msg.id} className="bg-card border rounded-lg p-4 shadow-sm">
                                       <div className="flex justify-between items-start mb-2">
                                         <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">
                                              {bulkRecipients.find(r => r.phone_number === msg.from_number)?.metadata?.name || msg.from_number}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {msg.from_number}
                                            </span>
                                         </div>
                                         <span className="text-xs text-muted-foreground">
                                           {formatMessageTime(msg.created_at)}
                                         </span>
                                       </div>
                                       <p className="text-sm bg-muted/30 p-3 rounded-md">{msg.content}</p>
                                     </div>
                                   ))
                                 )}
                               </div>
                             </ScrollArea>
                          </TabsContent>
                          
                          {/* Mottakerstatus & Påminnelse Tab */}
                          <TabsContent value="status" className="mt-0">
                            <CardContent className="p-3 pt-1">
                              <div className="space-y-2">
                                {/* Select all and send reminder section */}
                                <div className="flex items-center justify-between border-b pb-2">
                                  <p className="text-sm text-muted-foreground">
                                    {selectedForReminder.length > 0 
                                      ? `${selectedForReminder.length} ${t("inbox.recipients_selected_for_reminder")}`
                                      : t("inbox.select_recipients_for_reminder")}
                                  </p>
                                  <Button
                                    onClick={() => setReminderDialogOpen(true)}
                                    disabled={selectedForReminder.length === 0}
                                    size="sm"
                                  >
                                    {t("inbox.send_reminder")} ({selectedForReminder.length})
                                  </Button>
                                </div>
                                <div className="border rounded-md">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-12">
                                          <input
                                            type="checkbox"
                                            checked={selectedForReminder.length === bulkRecipients.filter(r => !bulkResponses.some(resp => resp.from_number === r.phone_number)).length && bulkRecipients.filter(r => !bulkResponses.some(resp => resp.from_number === r.phone_number)).length > 0}
                                            onChange={(e) => {
                                              const nonResponders = bulkRecipients.filter(r => !bulkResponses.some(resp => resp.from_number === r.phone_number));
                                              if (e.target.checked) {
                                                setSelectedForReminder(nonResponders.map(r => r.id));
                                              } else {
                                                setSelectedForReminder([]);
                                              }
                                            }}
                                            className="rounded"
                                          />
                                        </TableHead>
                                        <TableHead>{t("inbox.name")}</TableHead>
                                        <TableHead>{t("inbox.phone")}</TableHead>
                                        <TableHead>{t("inbox.status")}</TableHead>
                                        <TableHead>{t("inbox.action")}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {bulkRecipients.map((recipient) => {
                                        const hasResponded = bulkResponses.some(resp => resp.from_number === recipient.phone_number);
                                        return (
                                          <TableRow
                                            key={recipient.id}
                                            className={cn(
                                              hasResponded ? "bg-green-50/50 dark:bg-green-950/10" : "",
                                              hasReceivedReminder(recipient.phone_number) && 
                                              !hasResponded
                                                ? "bg-blue-50/30"
                                                : ""
                                            )}
                                          >
                                            <TableCell>
                                              <input
                                                type="checkbox"
                                                checked={selectedForReminder.includes(recipient.id)}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setSelectedForReminder([...selectedForReminder, recipient.id]);
                                                  } else {
                                                    setSelectedForReminder(selectedForReminder.filter(id => id !== recipient.id));
                                                  }
                                                }}
                                                disabled={hasResponded}
                                                className="rounded"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <div className="space-y-1">
                                                <div className="font-medium">{recipient.metadata?.name || recipient.phone_number}</div>
                                                {(() => {
                                                  const reminder = hasReceivedReminder(recipient.phone_number);
                                                  if (reminder) {
                                                    return (
                                                      <div className="text-xs text-muted-foreground space-y-0.5">
                                                        <div className="flex items-start gap-1.5">
                                                          <Mail className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
                                                          <span className="text-blue-600 font-medium">
                                                            "{reminder.content}"
                                                          </span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 pl-4.5">
                                                          Sendt: {new Date(reminder.created_at).toLocaleDateString("nb-NO", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric"
                                                          })} kl. {new Date(reminder.created_at).toLocaleTimeString("nb-NO", {
                                                            hour: "2-digit",
                                                            minute: "2-digit"
                                                          })}
                                                        </div>
                                                      </div>
                                                    );
                                                  }
                                                  return null;
                                                })()}
                                              </div>
                                            </TableCell>
                                            <TableCell>{recipient.phone_number}</TableCell>
                                            <TableCell>
                                              {hasResponded ? (
                                                <Badge className="bg-green-500 text-white">
                                                  ✓ {t("inbox.replied")}
                                                </Badge>
                                              ) : (
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="secondary">{t("inbox.waiting")}</Badge>
                                                  {(() => {
                                                    const reminder = hasReceivedReminder(recipient.phone_number);
                                                    return reminder ? (
                                                      <TooltipProvider>
                                                        <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <Badge 
                                                              variant="outline" 
                                                              className="cursor-help bg-blue-50 text-blue-700 border-blue-200 gap-1"
                                                            >
                                                              📩 {t("inbox.reminder")}
                                                            </Badge>
                                                          </TooltipTrigger>
                                                          <TooltipContent>
                                                            <p className="text-xs">
                                                              {t("inbox.sent")} {new Date(reminder.created_at).toLocaleString("nb-NO", {
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit"
                                                              })}
                                                            </p>
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    ) : null;
                                                  })()}
                                                </div>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  setSelectedRecipientForSim(recipient.id);
                                                  setSimulateDialogOpen(true);
                                                }}
                                              >
                                                {t("inbox.simulate_response")}
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </CardContent>
                          </TabsContent>
                        </Tabs>
                      </>
                    ) : (
                      // === STANDARD THREAD VIEW ===
                      <>
                        <CardHeader className="border-b py-3 px-3 lg:px-6 flex-none bg-muted/10">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                              {selectedThread.contact_phone}
                              <Badge variant="outline" className="text-xs font-normal">
                                {selectedThread.group_name}
                              </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleResolve()}
                                    className="h-9"
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    {t("inbox.resolve")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReclassifyDialogOpen(true)}
                                    className="h-9"
                                  >
                                    <ArrowRight className="h-4 w-4 mr-2" />
                                    {t("inbox.move")}
                                  </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="flex-1 p-4 overflow-y-auto">
                          {loading ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">{t("inbox.loading_messages")}</p>
                              </div>
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                              <p className="text-muted-foreground text-sm">{t("inbox.no_messages_in_thread")}</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {messages.map((message) => (
                                <div
                                  key={message.id}
                                  className={cn(
                                    "flex flex-col max-w-[85%] rounded-lg p-3",
                                    message.direction === "outbound"
                                      ? "ml-auto bg-primary text-primary-foreground"
                                      : "mr-auto bg-muted"
                                  )}
                                >
                                  <div className="flex justify-between items-baseline gap-2 mb-1">
                                    <span className="text-xs font-medium opacity-80">
                                      {message.direction === "outbound" ? t("inbox.you") : message.from_number}
                                    </span>
                                    <span className="text-[10px] opacity-70">
                                      {formatMessageTime(message.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                </div>
                              ))}
                              <div ref={messagesEndRef} />
                            </div>
                          )}
                        </CardContent>
                        
                        {/* Reply Input Area */}
                        <div className="p-4 border-t bg-background mt-auto">
                          <div className="flex gap-2">
                            <Textarea
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder={t("inbox.write_reply")}
                              className="min-h-[80px] resize-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendReply();
                                }
                              }}
                            />
                            <Button 
                              onClick={handleSendReply} 
                              disabled={sending || !newMessage.trim()}
                              className="h-[80px] px-6"
                            >
                              <Send className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )
                  ) : (
                    <CardContent className="flex-1 flex flex-col items-center justify-center bg-muted/5 h-full">
                      <div className="bg-muted/20 p-6 rounded-full mb-4">
                        <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground">{t("inbox.select_conversation")}</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs text-center">
                        {t("inbox.select_conversation_description")}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>

      {/* Simulate Response Dialog */}
      <Dialog open={simulateDialogOpen} onOpenChange={setSimulateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("inbox.simulate_response_on_bulk")}</DialogTitle>
            <DialogDescription>
              {t("inbox.simulate_response_description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inbox.select_recipient")}</label>
              <Select value={selectedRecipientForSim} onValueChange={setSelectedRecipientForSim}>
                <SelectTrigger>
                  <SelectValue placeholder={t("inbox.select_who_responds")} />
                </SelectTrigger>
                <SelectContent>
                  {bulkRecipients.map((recipient) => (
                    <SelectItem key={recipient.id} value={recipient.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{recipient.metadata?.name || t("inbox.unknown")}</span>
                        <span className="text-muted-foreground text-xs">({recipient.phone_number})</span>
                        {bulkResponses.some(r => r.from_number === recipient.phone_number) && (
                          <Badge variant="outline" className="text-[10px] ml-2">{t("inbox.already_replied")}</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRecipientForSim && (
              <div className="bg-muted/30 p-3 rounded-md border">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">{t("inbox.selected_recipient")}</p>
                <div className="flex justify-between items-center text-sm">
                  <span>{t("inbox.sender")}:</span>
                  <span className="font-mono">{bulkRecipients.find(r => r.id === selectedRecipientForSim)?.metadata?.name || t("inbox.unknown")}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inbox.simulated_reply_message")}</label>
              <Textarea
                placeholder={t("inbox.write_simulated_message")}
                value={simulatedMessage}
                onChange={(e) => setSimulatedMessage(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSimulateDialogOpen(false)}>
              {t("inbox.cancel")}
            </Button>
            <Button 
              onClick={handleSimulateResponse} 
              disabled={!selectedRecipientForSim || !simulatedMessage.trim() || sendingSimulation}
            >
              {sendingSimulation ? t("inbox.sending") : t("inbox.send_simulated_reply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reclassification Dialog */}
      <Dialog open={reclassifyDialogOpen} onOpenChange={setReclassifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inbox.move_conversation")}</DialogTitle>
            <DialogDescription>
              {t("inbox.move_conversation_description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-3 rounded-md border">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">{t("inbox.current_info")}</p>
              <div className="flex justify-between items-center text-sm">
                <span>{t("inbox.sender")}:</span>
                <span className="font-mono">{selectedThread?.contact_phone}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span>{t("inbox.received_in")}:</span>
                <span className="font-medium">{selectedThread?.group_name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inbox.select_new_group")}</label>
              <Select value={reclassifyTargetGroup} onValueChange={setReclassifyTargetGroup}>
                <SelectTrigger>
                  <SelectValue placeholder={t("inbox.search_or_select_group")} />
                </SelectTrigger>
                <SelectContent>
                  {groups
                    .filter((g) => g.id !== selectedThread?.resolved_group_id)
                    .map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReclassifyDialogOpen(false)}>
              {t("inbox.cancel")}
            </Button>
            <Button onClick={handleReclassify} disabled={!reclassifyTargetGroup}>
              {t("inbox.move_conversation_action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Compose Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("inbox.send_reminder")}</DialogTitle>
            <DialogDescription>
              {t("inbox.write_custom_reminder")} {selectedForReminder.length} {t("inbox.recipients")}
            </DialogDescription>
          </DialogHeader>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Textarea
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              placeholder={t("inbox.reminder_example")}
              className="min-h-[120px] resize-none"
              disabled={sending}
            />
          </motion.div>

          {sending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{t("inbox.sending_reminders")}</span>
                <span>{sendingProgress.sent} / {sendingProgress.total}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${(sendingProgress.sent / sendingProgress.total) * 100}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReminderDialogOpen(false);
                setReminderMessage("");
              }}
              disabled={sending}
            >
              {t("inbox.cancel")}
            </Button>
            <Button
              onClick={handleSendReminder}
              disabled={sending || !reminderMessage.trim()}
              className="relative overflow-hidden"
            >
              {sending ? (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                  />
                  {t("inbox.sending")}
                </motion.div>
              ) : (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {t("inbox.send_reminder")}
                </motion.span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}