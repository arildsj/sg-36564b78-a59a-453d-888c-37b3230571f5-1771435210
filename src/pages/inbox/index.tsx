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
  Inbox as InboxIcon,
  AlertTriangle,
  FolderInput,
  Archive,
  ArrowRight,
  ArrowLeft,
  Users,
  PlayCircle
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
  type ExtendedMessageThread 
} from "@/services/messageService";
import { groupService, type Group } from "@/services/groupService";
import { bulkService, type BulkRecipient } from "@/services/bulkService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export default function InboxPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "fallback" | "escalated">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [threads, setThreads] = useState<ExtendedMessageThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Bulk view state
  const [bulkRecipients, setBulkRecipients] = useState<BulkRecipient[]>([]);
  const [bulkResponses, setBulkResponses] = useState<any[]>([]);
  const [bulkTab, setBulkTab] = useState<"responses" | "status">("responses");
  const [selectedForReminder, setSelectedForReminder] = useState<string[]>([]);

  // Simulation dialog state
  const [simulateDialogOpen, setSimulateDialogOpen] = useState(false);
  const [selectedRecipientForSim, setSelectedRecipientForSim] = useState<string>("");
  const [simulatedMessage, setSimulatedMessage] = useState("");
  const [sendingSimulation, setSendingSimulation] = useState(false);

  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  
  // Restored missing state variables
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [reclassifyDialogOpen, setReclassifyDialogOpen] = useState(false);
  const [reclassifyTargetGroup, setReclassifyTargetGroup] = useState<string>("");

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

    const channel = supabase
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
      supabase.removeChannel(channel);
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

        const { data: responses } = await supabase
          .from("messages")
          .select("*")
          .eq("campaign_id", threadId)
          .eq("direction", "inbound")
          .order("created_at", { ascending: true });
          
        setBulkResponses((responses as any) || []);
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

      // Normalize phone number to E.164 format (+XXXXXXXXXXX)
      const normalizedPhone = recipient.phone_number.replace(/[\s\-\(\)]/g, "");
      const phoneWithPlus = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;

      // Validate phone format matches constraint (+ followed by 8-15 digits)
      if (!/^\+[0-9]{8,15}$/.test(phoneWithPlus)) {
        toast({
          title: "Ugyldig telefonnummer",
          description: "Telefonnummeret må være i formatet +XXXXXXXXXXX (8-15 siffer)",
          variant: "destructive",
        });
        return;
      }

      // Get current user for tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Du må være logget inn");
      }

      // Get campaign to find source_group_id
      // selectedThread represents the campaign in this view
      const campaignId = selectedThread?.id;
      
      const { data: campaign } = await supabase
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
      const { data: gateway } = await supabase
        .from("gateways")
        .select("id, phone_number")
        .eq("tenant_id", user.user_metadata?.tenant_id || user.id) // Try to get tenant gateway
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
           // Simpler: just use the tenant gateway found above for now to ensure it works.
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
            const { data: anyGateway } = await supabase.from("gateways").select("id, phone_number").limit(1).maybeSingle();
            if (anyGateway) {
                gatewayId = anyGateway.id;
                systemPhoneNumber = anyGateway.phone_number;
            } else {
                 throw new Error("Ingen gateway funnet. Kan ikke opprette samtale.");
            }
         }
      }

      // Check if thread exists for this contact
      const { data: existingThread } = await supabase
        .from("message_threads")
        .select("id")
        .eq("tenant_id", user.user_metadata?.tenant_id || user.id) 
        .eq("contact_phone", phoneWithPlus)
        .eq("resolved_group_id", groupId)
        .maybeSingle();

      let threadId = existingThread?.id;

      // Create thread if it doesn't exist
      if (!threadId) {
        // Note: Removed contact_name as it caused type errors
        const { data: newThread, error: threadError } = await supabase
          .from("message_threads")
          .insert({
            contact_phone: phoneWithPlus,
            last_message_at: new Date().toISOString(),
            is_resolved: false,
            resolved_group_id: groupId,
            gateway_id: gatewayId,
            tenant_id: user.user_metadata?.tenant_id || user.id
          })
          .select()
          .single();

        if (threadError) throw threadError;
        threadId = newThread.id;
      }

      // Create the simulated inbound message
      const { error: messageError } = await supabase.from("messages").insert({
        thread_key: phoneWithPlus,
        direction: "inbound",
        from_number: phoneWithPlus, 
        to_number: systemPhoneNumber,
        content: simulatedMessage, 
        group_id: groupId,
        thread_id: threadId,
        campaign_id: campaignId,
        tenant_id: user.user_metadata?.tenant_id || user.id
      });

      if (messageError) {
        throw messageError;
      }

      // Update bulk_recipient with response info
      await supabase
        .from("bulk_recipients")
        .update({
          responded_at: new Date().toISOString(),
          response_message_id: threadId,
        })
        .eq("id", recipient.id);

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
    if (selectedForReminder.length === 0 || !reminderMessage.trim() || !selectedThreadId) return;
    
    setSending(true);
    
    try {
      const recipientsToSend = bulkRecipients.filter(r => selectedForReminder.includes(r.id));
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      // Get campaign info to find correct from_number/gateway
      const { data: campaign } = await supabase
        .from("bulk_campaigns")
        .select("source_group_id")
        .eq("id", selectedThreadId)
        .single();
        
      let fromNumber = "System";
      
      if (campaign?.source_group_id) {
        // First try to get gateway from source group
        const { data: group } = await supabase
          .from("groups")
          .select("gateway_id")
          .eq("id", campaign.source_group_id)
          .single();
          
        if (group?.gateway_id) {
          const { data: gateway } = await supabase
            .from("gateways")
            .select("phone_number")
            .eq("id", group.gateway_id)
            .single();
          if (gateway) fromNumber = gateway.phone_number;
        } else {
          // Fallback to default gateway if group has none
           const { data: defaultGateway } = await supabase
            .from("gateways")
            .select("phone_number")
            .eq("tenant_id", user.user_metadata?.tenant_id || user.id)
            .eq("is_default", true)
            .maybeSingle();
            
           if (defaultGateway) fromNumber = defaultGateway.phone_number;
        }
      }

      const updates = recipientsToSend.map(async (recipient) => {
        // Create outbound message record linked to campaign
        const { error: msgError } = await supabase.from("messages").insert({
          content: reminderMessage,
          direction: "outbound",
          status: "queued", // System will pick this up if configured, or it's just a log
          to_number: recipient.phone_number,
          from_number: fromNumber,
          campaign_id: selectedThreadId,
          tenant_id: user.user_metadata?.tenant_id || user.id,
          thread_key: recipient.phone_number // Ensure it groups correctly if individual thread exists
        });

        if (msgError) throw msgError;

        // Optionally update bulk_recipient status to indicate reminder sent?
        // Current schema might not have last_reminder_at, but we can assume it's tracked via messages
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
        <title>Samtaler | SeMSe</title>
        <meta name="description" content="Behandle innkommende og utgående meldinger" />
      </Head>

      <AppLayout>
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
          <div className="flex-none">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Samtaler</h2>
            <p className="text-muted-foreground mt-2">
              Håndter meldinger fra dine grupper.
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
                  Alle samtaler
                </TabsTrigger>
                <TabsTrigger value="fallback" className="gap-2">
                  <FolderInput className="h-4 w-4" />
                  Ukjente avsendere
                </TabsTrigger>
                <TabsTrigger value="escalated" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Eskalerte
                </TabsTrigger>
              </TabsList>

              <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filtrer etter gruppe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle grupper</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value={activeTab} className="flex-1 m-0 min-h-0 overflow-hidden flex flex-col">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Thread List */}
                <Card className="lg:col-span-1 flex flex-col h-full overflow-hidden">
                  <CardHeader className="border-b py-3 px-4 flex-none">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Samtaler ({filteredThreads.length})
                    </CardTitle>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                      {loading ? (
                        <p className="text-muted-foreground text-center py-8 text-sm">Laster...</p>
                      ) : filteredThreads.length === 0 ? (
                        <div className="text-center py-12 px-4">
                          <InboxIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
                          <p>Ingen samtaler</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {activeTab === "fallback"
                              ? "Ingen ukjente avsendere for øyeblikket"
                              : activeTab === "escalated"
                              ? "Ingen eskalerte meldinger"
                              : "Meldinger vil vises her når de ankommer"}
                          </p>
                        </div>
                      ) : (
                        filteredThreads.map((thread) => (
                          <button
                            key={thread.id}
                            onClick={() => setSelectedThreadId(thread.id)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
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
                                        {thread.subject_line || "Bulk Uten Emne"}
                                      </span>
                                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                        Bulk
                                      </Badge>
                                      {thread.recipient_stats && (
                                        <span className="text-[10px] text-muted-foreground ml-auto">
                                          {thread.recipient_stats.responded}/{thread.recipient_stats.total} svar
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
                                      Ukjent
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <Badge variant="outline" className="text-[10px] h-5 px-1 font-normal bg-muted">
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

                {/* Message Thread View */}
                <Card className="lg:col-span-2 flex flex-col h-full overflow-hidden">
                  {selectedThread ? (
                    selectedThread.is_bulk ? (
                      // === BULK CAMPAIGN DETAIL VIEW ===
                      <>
                        <CardHeader className="border-b py-3 px-6 flex-none bg-blue-50/50 dark:bg-blue-900/10">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Bulk-kampanje</Badge>
                                <span className="text-xs text-muted-foreground font-mono">ID: {selectedThread.id.slice(0, 8)}</span>
                              </div>
                              <CardTitle className="text-xl mt-2 mb-1">
                                {selectedThread.subject_line || "Uten emne"}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground max-w-2xl line-clamp-2">
                                {selectedThread.last_message_content}
                              </p>
                            </div>
                            <div className="text-right">
                               <div className="text-2xl font-bold">
                                 {selectedThread.recipient_stats?.responded || 0} / {selectedThread.recipient_stats?.total || 0}
                               </div>
                               <div className="text-xs text-muted-foreground">har svart</div>
                               <Button 
                                 size="sm" 
                                 variant="outline" 
                                 className="mt-2 gap-2"
                                 onClick={() => setSimulateDialogOpen(true)}
                               >
                                 <Users className="h-4 w-4" />
                                 Simuler svar
                               </Button>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <Tabs value={bulkTab} onValueChange={(v: any) => setBulkTab(v)} className="flex-1 flex flex-col min-h-0">
                          <div className="border-b px-6">
                            <TabsList className="bg-transparent p-0 h-auto gap-6">
                              <TabsTrigger 
                                value="responses" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3"
                              >
                                Innk. Svar ({bulkResponses.length})
                              </TabsTrigger>
                              <TabsTrigger 
                                value="status" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3"
                              >
                                Mottakerstatus & Påminnelse
                              </TabsTrigger>
                            </TabsList>
                          </div>

                          <TabsContent value="responses" className="flex-1 p-0 m-0 overflow-hidden flex flex-col">
                             <ScrollArea className="flex-1">
                               <div className="p-6 space-y-4">
                                 {bulkResponses.length === 0 ? (
                                   <div className="text-center py-12">
                                     <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                                     <h3 className="text-lg font-medium text-muted-foreground">Ingen svar mottatt ennå</h3>
                                     <p className="text-sm text-muted-foreground mt-1">Svar fra mottakere vil dukke opp her.</p>
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
                                      ? `${selectedForReminder.length} mottaker(e) valgt for påminnelse`
                                      : "Velg mottakere for å sende påminnelse"}
                                  </p>
                                  <Button
                                    onClick={() => setReminderDialogOpen(true)}
                                    disabled={selectedForReminder.length === 0}
                                    size="sm"
                                  >
                                    Send påminnelse ({selectedForReminder.length})
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
                                        <TableHead>NAVN</TableHead>
                                        <TableHead>TELEFON</TableHead>
                                        <TableHead>STATUS</TableHead>
                                        <TableHead>HANDLING</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {bulkRecipients.map((recipient) => {
                                        const hasResponded = bulkResponses.some(resp => resp.from_number === recipient.phone_number);
                                        return (
                                          <TableRow
                                            key={recipient.id}
                                            className={hasResponded ? "bg-green-50/50 dark:bg-green-950/10" : ""}
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
                                            <TableCell className="font-medium">
                                              {recipient.metadata?.name || "Ukjent"}
                                            </TableCell>
                                            <TableCell>{recipient.phone_number}</TableCell>
                                            <TableCell>
                                              <Badge
                                                variant={hasResponded ? "default" : "outline"}
                                                className={hasResponded ? "bg-green-600 hover:bg-green-700" : "text-muted-foreground"}
                                              >
                                                {hasResponded ? "✓ Svart" : "Venter"}
                                              </Badge>
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
                                                Simuler svar
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
                        <CardHeader className="border-b py-3 px-6 flex-none bg-muted/10">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                {selectedThread.contact_phone}
                                {selectedThread.is_fallback && (
                                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                                    Ukjent avsender
                                  </Badge>
                                )}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-muted-foreground">Gruppe:</p>
                                <Badge variant="secondary" className="font-medium text-foreground">
                                  {selectedThread.group_name}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => setReclassifyDialogOpen(true)}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                              >
                                <FolderInput className="h-4 w-4" />
                                <span className="hidden sm:inline">Flytt samtalen</span>
                              </Button>
                              
                              {hasUnacknowledged && (
                                <Button 
                                  onClick={handleAcknowledge} 
                                  variant="default" 
                                  size="sm" 
                                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCheck className="h-4 w-4" />
                                  <span className="hidden sm:inline">Bekreft mottatt</span>
                                </Button>
                              )}
                              <Button 
                                onClick={handleResolve} 
                                variant="ghost" 
                                size="sm" 
                                className="gap-2 text-muted-foreground hover:text-foreground"
                              >
                                <Archive className="h-4 w-4" />
                                <span className="hidden sm:inline">Løs</span>
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <ScrollArea className="flex-1 p-6 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950/20 dark:to-slate-900/30">
                          <div className="space-y-4 max-w-4xl mx-auto">
                            {messages.length === 0 ? (
                              <p className="text-muted-foreground text-center py-8 text-sm">Ingen meldinger</p>
                            ) : (
                              messages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={cn(
                                    "flex",
                                    msg.direction === "outbound" ? "justify-end" : "justify-start"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex flex-col max-w-[75%] rounded-2xl px-4 py-3 shadow-md",
                                      msg.direction === "outbound"
                                        ? "bg-blue-600 text-white rounded-br-md"
                                        : "bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-slate-700 rounded-bl-md"
                                    )}
                                  >
                                    {msg.group_id && msg.group_id !== selectedThread.resolved_group_id && (
                                      <div className="mb-1 text-[9px] text-muted-foreground opacity-70">
                                        Fra gruppe: {groups.find(g => g.id === msg.group_id)?.name || 'Ukjent'}
                                      </div>
                                    )}

                                    {msg.is_fallback && msg.direction === "inbound" && (
                                      <div className="mb-2 pb-2 border-b border-yellow-400/30 flex items-center gap-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>Ukjent avsender</span>
                                      </div>
                                    )}
                                    
                                    <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                                    
                                    <div className={cn(
                                      "mt-2 flex items-center gap-2 text-[10px] font-medium",
                                      msg.direction === "outbound" 
                                        ? "justify-end text-blue-100" 
                                        : "justify-start text-gray-500 dark:text-gray-400"
                                    )}>
                                      <span>{formatMessageTime(msg.created_at)}</span>
                                      {msg.direction === "outbound" ? (
                                        <ArrowRight className="h-3 w-3" />
                                      ) : (
                                        <ArrowLeft className="h-3 w-3" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>

                        <CardContent className="border-t p-4 bg-background">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSendReply();
                            }}
                            className="flex gap-3"
                          >
                            <Textarea
                              placeholder={`Svar til ${selectedThread.contact_phone}...`}
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendReply();
                                }
                              }}
                              className="flex-1 min-h-[50px] max-h-[150px] resize-none focus-visible:ring-1"
                              rows={1}
                              disabled={sending}
                            />
                            <Button
                              type="submit"
                              disabled={!newMessage.trim() || sending}
                              className="h-[50px] w-[50px] rounded-full p-0 flex-none shrink-0"
                              size="icon"
                            >
                              <Send className="h-5 w-5" />
                            </Button>
                          </form>
                        </CardContent>
                      </>
                    )
                  ) : (
                    <CardContent className="flex-1 flex flex-col items-center justify-center bg-muted/5 h-full">
                      <div className="bg-muted/20 p-6 rounded-full mb-4">
                        <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground">Velg en samtale</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs text-center">
                        Velg en samtale fra listen til venstre for å se meldingshistorikk og svare.
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
            <DialogTitle>Simuler svar på bulk-utsendelse</DialogTitle>
            <DialogDescription>
              Velg en mottaker og skriv et simulert svar som om det kom fra dem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Velg mottaker</label>
              <Select value={selectedRecipientForSim} onValueChange={setSelectedRecipientForSim}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg hvem som skal svare..." />
                </SelectTrigger>
                <SelectContent>
                  {bulkRecipients.map((recipient) => (
                    <SelectItem key={recipient.id} value={recipient.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{recipient.metadata?.name || 'Ukjent'}</span>
                        <span className="text-muted-foreground text-xs">({recipient.phone_number})</span>
                        {bulkResponses.some(r => r.from_number === recipient.phone_number) && (
                          <Badge variant="outline" className="text-[10px] ml-2">Har allerede svart</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRecipientForSim && (
              <div className="bg-muted/30 p-3 rounded-md border">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Valgt mottaker</p>
                <div className="flex justify-between items-center text-sm">
                  <span>Avsender:</span>
                  <span className="font-mono">{bulkRecipients.find(r => r.id === selectedRecipientForSim)?.metadata?.name || 'Ukjent'}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Simulert svarmelding</label>
              <Textarea
                placeholder="Skriv svarmeldingen som skal simuleres..."
                value={simulatedMessage}
                onChange={(e) => setSimulatedMessage(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSimulateDialogOpen(false)}>
              Avbryt
            </Button>
            <Button 
              onClick={handleSimulateResponse} 
              disabled={!selectedRecipientForSim || !simulatedMessage.trim() || sendingSimulation}
            >
              {sendingSimulation ? "Sender..." : "Send simulert svar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reclassification Dialog */}
      <Dialog open={reclassifyDialogOpen} onOpenChange={setReclassifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flytt samtale</DialogTitle>
            <DialogDescription>
              Flytt denne samtalen til en annen gruppe. Samtalen vil forsvinne fra denne innboksen og vises hos den valgte gruppen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-3 rounded-md border">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Nåværende info</p>
              <div className="flex justify-between items-center text-sm">
                <span>Avsender:</span>
                <span className="font-mono">{selectedThread?.contact_phone}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span>Mottatt i:</span>
                <span className="font-medium">{selectedThread?.group_name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Velg ny gruppe</label>
              <Select value={reclassifyTargetGroup} onValueChange={setReclassifyTargetGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Søk eller velg gruppe..." />
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
              Avbryt
            </Button>
            <Button onClick={handleReclassify} disabled={!reclassifyTargetGroup}>
              Flytt samtalen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Compose Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send påminnelse</DialogTitle>
            <DialogDescription>
              Skriv en påminnelse til de {selectedForReminder.length} valgte mottakerne.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Meldingstekst</label>
              <Textarea
                placeholder="Hei, vi venter fortsatt på svar fra deg..."
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Denne meldingen sendes som SMS til alle valgte mottakere.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
              Avbryt
            </Button>
            <Button 
              onClick={handleSendReminder} 
              disabled={!reminderMessage.trim() || sending}
            >
              {sending ? "Sender..." : "Send påminnelse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}