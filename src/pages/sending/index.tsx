import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Send,
  Clock,
  FileText,
  ChevronDown,
  ChevronRight,
  Megaphone,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Hash,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bulkService } from "@/services/bulkService";
import { groupService, type Group as ServiceGroup } from "@/services/groupService";
import { contactService, type Contact } from "@/services/contactService";
import { messageService } from "@/services/messageService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const db = supabase as any;

type GroupSelection = {
  groupId: string;
  selectedContactIds: string[];
};

type CampaignHistory = {
  id: string;
  name: string;
  message_template: string;
  status: string;
  created_at: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  group_id: string | null;
};

type CampaignRecipient = {
  id: string;
  phone: string;
  name?: string;
  status: string;
  sent_at: string | null;
};

type CampaignMessage = {
  id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  created_at: string;
  content: string;
  status: string;
  external_id: string | null;
};

export default function SendingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("compose");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  
  // Campaign state
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignHistory | null>(null);
  const [campaignRecipients, setCampaignRecipients] = useState<CampaignRecipient[]>([]);
  const [campaignInboundMessages, setCampaignInboundMessages] = useState<CampaignMessage[]>([]);
  const [campaignReminderMessages, setCampaignReminderMessages] = useState<CampaignMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedForReminder, setSelectedForReminder] = useState<string[]>([]);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [campaignDetailDialogOpen, setCampaignDetailDialogOpen] = useState(false);
  
  // New state structure for granular contact selection
  const [selectedGroups, setSelectedGroups] = useState<GroupSelection[]>([]);
  const [groupContacts, setGroupContacts] = useState<Map<string, Contact[]>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Form states
  const [message, setMessage] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [requireAck, setRequireAck] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch contacts when a group is selected/expanded
  useEffect(() => {
    expandedGroups.forEach(groupId => {
      if (!groupContacts.has(groupId)) {
        contactService.getContactsByGroup(groupId).then(contacts => {
          setGroupContacts(prev => new Map(prev).set(groupId, contacts));
        }).catch(error => {
          console.error(`Error fetching contacts for group ${groupId}:`, error);
        });
      }
    });
  }, [expandedGroups]);

  const fetchData = async () => {
    try {
      const groupsData = await groupService.getOperationalGroups();
      setGroups(groupsData);
      await loadCampaignHistory();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadCampaignHistory = async () => {
    try {
      setCampaignLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: profile } = await db
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", auth.user.id)
        .single();

      if (!profile?.tenant_id) return;

      const { data, error } = await db
        .from("bulk_campaigns")
        .select("id, name, message_template, status, created_at, total_recipients, sent_count, failed_count, group_id")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setCampaigns((data || []) as CampaignHistory[]);
    } catch (error) {
      console.error("Error loading campaign history:", error);
    } finally {
      setCampaignLoading(false);
    }
  };

  const loadCampaignDetails = async (campaignId: string) => {
    try {
      setHistoryLoading(true);
      setSelectedForReminder([]);

      const campaign = campaigns.find((c: CampaignHistory) => c.id === campaignId) || null;
      setSelectedCampaign(campaign);
      setSelectedCampaignId(campaignId);

      const { data: recipientsData, error: recipientsError } = await db
        .from("campaign_recipients")
        .select("id, phone, status, sent_at, contacts(name)")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      if (recipientsError) throw recipientsError;

      const mappedRecipients: CampaignRecipient[] = (recipientsData || []).map((r: any) => ({
        id: r.id,
        phone: r.phone,
        name: r.contacts?.name,
        status: r.status,
        sent_at: r.sent_at,
      }));
      setCampaignRecipients(mappedRecipients);

      // campaign_id is never populated on messages — match both directions by
      // recipient phone numbers and anything sent/received after the campaign.
      const recipientPhones = mappedRecipients.map((r) => r.phone);
      const campaignCreatedAt = campaign?.created_at ?? "1970-01-01T00:00:00Z";
      const MSG_SELECT = "id, direction, from_number, to_number, created_at, content, status, external_id";

      let outbound: CampaignMessage[] = [];
      let inbound: CampaignMessage[] = [];

      if (recipientPhones.length > 0) {
        const { data: outboundData, error: outboundError } = await db
          .from("messages")
          .select(MSG_SELECT)
          .eq("direction", "outbound")
          .in("to_number", recipientPhones)
          .gte("created_at", campaignCreatedAt)
          .order("created_at", { ascending: true });

        if (outboundError) throw outboundError;
        outbound = (outboundData || []) as CampaignMessage[];

        const { data: inboundData, error: inboundError } = await db
          .from("messages")
          .select(MSG_SELECT)
          .eq("direction", "inbound")
          .in("from_number", recipientPhones)
          .gte("created_at", campaignCreatedAt)
          .order("created_at", { ascending: true });

        if (inboundError) throw inboundError;
        inbound = (inboundData || []) as CampaignMessage[];
      }

      setCampaignInboundMessages(inbound);
      setCampaignReminderMessages(outbound);

      // Pre-select all non-responders by default
      const inboundPhones = new Set(inbound.map((m) => m.from_number));
      const preSelected = mappedRecipients
        .filter((r) => !inboundPhones.has(r.phone))
        .map((r) => r.id);
      setSelectedForReminder(preSelected);
    } catch (error) {
      console.error("Error loading campaign details:", error);
      toast({
        title: "Kunne ikke laste kampanjedetaljer",
        description: "Prøv igjen om et øyeblikk.",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const hasResponded = (phone: string) => {
    return campaignInboundMessages.some((msg) => msg.from_number === phone);
  };

  const getLatestReminder = (phone: string) => {
    const reminders = campaignReminderMessages.filter((msg) => msg.to_number === phone);
    return reminders.length > 0 ? reminders[reminders.length - 1] : null;
  };

  const getOutboundMessage = (phone: string) => {
    return campaignReminderMessages.find((msg) => msg.to_number === phone) || null;
  };

  const getReminders = (phone: string): CampaignMessage[] => {
    const all = campaignReminderMessages.filter((msg) => msg.to_number === phone);
    return all.slice(1); // first entry is the original campaign message; rest are reminders
  };

  const getInboundReply = (phone: string) => {
    return campaignInboundMessages.find((msg) => msg.from_number === phone) || null;
  };

  const fmtTime = (ts: string | null | undefined) => {
    if (!ts) return null;
    return new Date(ts).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
  };

  const shortId = (msg: CampaignMessage | null) => {
    if (!msg) return "–";
    return (msg.external_id || msg.id).substring(0, 8).toUpperCase();
  };

  const campaignStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Fullført";
      case "sending": return "Aktiv";
      case "failed": return "Feilet";
      default: return status;
    }
  };

  const campaignStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": return "default";
      case "sending": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  const nonResponders = campaignRecipients.filter((recipient) => !hasResponded(recipient.phone));

  const handleSendReminder = async () => {
    if (!selectedCampaign || selectedForReminder.length === 0 || !reminderMessage.trim()) {
      return;
    }

    try {
      setSendingReminder(true);
      let successCount = 0;

      const recipientsToSend = campaignRecipients.filter((r) => selectedForReminder.includes(r.id));

      for (const recipient of recipientsToSend) {
        const sentMessage = await messageService.sendMessage(
          reminderMessage,
          recipient.phone,
          "system",
          undefined,
          selectedCampaign.group_id || undefined
        );

        await db
          .from("messages")
          .update({ campaign_id: selectedCampaign.id })
          .eq("id", sentMessage.id);

        successCount++;
      }

      toast({
        title: "Påminnelser sendt",
        description: `${successCount} påminnelse${successCount === 1 ? "" : "r"} sendt.`,
      });

      setReminderDialogOpen(false);
      setReminderMessage("");
      await loadCampaignDetails(selectedCampaign.id);
      setCampaignDetailDialogOpen(true);
    } catch (error: any) {
      console.error("Error sending reminders:", error);
      toast({
        title: "Feil ved sending av påminnelse",
        description: error.message || "Kunne ikke sende påminnelser",
        variant: "destructive",
      });
    } finally {
      setSendingReminder(false);
    }
  };

  // Helper functions
  const isGroupSelected = (groupId: string): boolean => {
    return selectedGroups.some(g => g.groupId === groupId);
  };

  const getGroupSelection = (groupId: string): GroupSelection | undefined => {
    return selectedGroups.find(g => g.groupId === groupId);
  };

  const getSelectedContactCount = (groupId: string): number => {
    return getGroupSelection(groupId)?.selectedContactIds.length || 0;
  };

  const getTotalContactCount = (groupId: string): number => {
    return groupContacts.get(groupId)?.length || 0;
  };

  const areAllContactsSelected = (groupId: string): boolean => {
    const selection = getGroupSelection(groupId);
    const totalContacts = getTotalContactCount(groupId);
    return selection ? selection.selectedContactIds.length === totalContacts && totalContacts > 0 : false;
  };

  const isContactSelected = (groupId: string, contactId: string): boolean => {
    const selection = getGroupSelection(groupId);
    return selection ? selection.selectedContactIds.includes(contactId) : false;
  };

  // Toggle functions
  const toggleGroup = (groupId: string) => {
    if (isGroupSelected(groupId)) {
      // Deselect group - remove from selection
      setSelectedGroups(prev => prev.filter(g => g.groupId !== groupId));
      setExpandedGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
    } else {
      // Select group - add to selection with empty contacts
      setSelectedGroups(prev => [...prev, { groupId, selectedContactIds: [] }]);
      setExpandedGroups(prev => new Set(prev).add(groupId));
    }
  };

  const toggleAllContacts = (groupId: string) => {
    const contacts = groupContacts.get(groupId) || [];
    const allContactIds = contacts.map(c => c.id);
    
    setSelectedGroups(prev => prev.map(g => {
      if (g.groupId === groupId) {
        // If all are selected, deselect all. Otherwise, select all.
        const allSelected = g.selectedContactIds.length === allContactIds.length;
        return {
          ...g,
          selectedContactIds: allSelected ? [] : allContactIds
        };
      }
      return g;
    }));
  };

  const toggleContact = (groupId: string, contactId: string) => {
    setSelectedGroups(prev => prev.map(g => {
      if (g.groupId === groupId) {
        const isSelected = g.selectedContactIds.includes(contactId);
        return {
          ...g,
          selectedContactIds: isSelected
            ? g.selectedContactIds.filter(id => id !== contactId)
            : [...g.selectedContactIds, contactId]
        };
      }
      return g;
    }));
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: "Mangler melding",
        description: "Du må skrive en melding før du sender",
        variant: "destructive",
      });
      return;
    }

    if (selectedGroups.length === 0) {
      toast({
        title: "Mangler mottakere",
        description: "Velg minst én mottakergruppe eller kontakt",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      console.log("🚀 Starting message send process...");

      // Get user profile for tenant_id and created_by
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("user_profiles")
        .select("id, tenant_id")
        .eq("id", user.user.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      console.log("✅ User authenticated:", profile.id);

      // Calculate total recipients and collect contact data
      let totalRecipients = 0;
      const recipientData: Array<{ contact: Contact; groupId: string }> = [];

      for (const group of selectedGroups) {
        const contacts = groupContacts.get(group.groupId) || [];
        console.log(`📋 Group ${group.groupId}: ${contacts.length} total contacts`);
        
        if (group.selectedContactIds.length > 0) {
          // Send to selected contacts only
          const selectedContacts = contacts.filter(c => 
            group.selectedContactIds.includes(c.id)
          );
          console.log(`✅ Selected ${selectedContacts.length} contacts from group ${group.groupId}`);
          totalRecipients += selectedContacts.length;
          recipientData.push(...selectedContacts.map(c => ({ contact: c, groupId: group.groupId })));
        } else {
          // Send to all contacts in group
          console.log(`✅ Sending to all ${contacts.length} contacts in group ${group.groupId}`);
          totalRecipients += contacts.length;
          recipientData.push(...contacts.map(c => ({ contact: c, groupId: group.groupId })));
        }
      }

      if (totalRecipients === 0) {
        toast({
          title: "Ingen mottakere",
          description: "De valgte gruppene har ingen kontakter",
          variant: "destructive",
        });
        return;
      }

      console.log(`📊 Total recipients: ${totalRecipients}`);

      // Create bulk campaign for tracking/history
      const groupNames = selectedGroups
        .map(sg => groups.find(g => g.id === sg.groupId)?.name)
        .filter(Boolean)
        .join(", ");

      console.log("💾 Creating campaign record for history...");

      // Determine campaign type based on scheduling and recipient count
      const isScheduled = !!scheduleDate;
      const campaignType = 
        isScheduled ? "scheduled" as const :
        totalRecipients === 1 ? "single" as const : 
        "bulk" as const;

      const campaign = await bulkService.createBulkCampaign({
        name: `Melding til ${groupNames}`,
        message_template: message,
        total_recipients: totalRecipients,
        campaign_type: campaignType,
        status: isScheduled ? "scheduled" : "sending",
        sent_immediately: !isScheduled,
        scheduled_at: scheduleDate || null,
        tenant_id: profile.tenant_id,
        created_by: profile.id,
        group_id: selectedGroups[0].groupId,
        started_at: isScheduled ? undefined : new Date().toISOString(),
        gateway_id: null
      });

      console.log("✅ Campaign created:", campaign.id);

      // Create campaign recipients for history
      const recipients = recipientData.map(({ contact }) => ({
        campaign_id: campaign.id,
        contact_id: contact.id,
        phone: contact.phone,
        status: "pending" as const,
        personalized_message: message
      }));

      if (recipients.length > 0) {
        console.log("💾 Creating campaign recipients records...");
        const { error: recipientsError } = await db
          .from("campaign_recipients")
          .insert(recipients);

        if (recipientsError) {
          console.error("❌ Error creating recipients:", recipientsError);
          throw new Error("Failed to create campaign recipients");
        }
        console.log(`✅ Created ${recipients.length} recipient records`);
      }

      // Send messages directly using messageService if not scheduled
      if (!scheduleDate) {
        console.log("📤 Sending messages now...");
        let successCount = 0;
        let failureCount = 0;

        for (const { contact, groupId } of recipientData) {
          try {
            console.log(`📨 Sending to ${contact.name} (${contact.phone})...`);
            
            // Use messageService to send with proper thread logic
            // sendMessage(content, toNumber, fromNumber, threadId?, explicitGroupId?)
            const newMessage = await messageService.sendMessage(
              message,              // content
              contact.phone,        // toNumber
              "system",            // fromNumber (no physical gateway in development)
              undefined,           // threadId (let messageService find/create)
              groupId              // explicitGroupId
            );

            console.log(`✅ Message created:`, newMessage.id);

            // Update recipient status
            await db
              .from("campaign_recipients")
              .update({
                status: "sent",
                message_id: newMessage.id,
                sent_at: new Date().toISOString()
              })
              .eq("campaign_id", campaign.id)
              .eq("contact_id", contact.id);

            successCount++;
          } catch (error) {
            console.error(`❌ Failed to send to ${contact.name}:`, error);
            
            // Update recipient with error
            await db
              .from("campaign_recipients")
              .update({
                status: "failed",
                error_message: error instanceof Error ? error.message : "Unknown error"
              })
              .eq("campaign_id", campaign.id)
              .eq("contact_id", contact.id);

            failureCount++;
          }
        }

        console.log(`📊 Send complete: ${successCount} success, ${failureCount} failed`);

        // Update campaign status: completed if all succeeded, failed if any failed
        const finalStatus = failureCount === 0 ? "completed" : "failed";

        await db
          .from("bulk_campaigns")
          .update({
            status: finalStatus,
            sent_count: successCount,
            failed_count: failureCount,
            completed_at: new Date().toISOString()
          })
          .eq("id", campaign.id);

        console.log("✅ Campaign status updated");

        toast({
          title: "Meldinger sendt",
          description: `${successCount} av ${totalRecipients} meldinger ble opprettet${failureCount > 0 ? ` (${failureCount} feilet)` : ""}`,
        });
      } else {
        console.log(`⏰ Messages scheduled for ${scheduleDate}`);
        toast({
          title: "Melding planlagt",
          description: `Meldingen sendes ${new Date(scheduleDate).toLocaleString()}`,
        });
      }

      // Reset form
      setMessage("");
      setSelectedGroups([]);
      setExpandedGroups(new Set());
      setScheduleDate("");
      setIsUrgent(false);
      setRequireAck(false);
      setActiveTab("history");

    } catch (error: any) {
      console.error("❌ Error in handleSend:", error);
      toast({
        title: "Feil ved sending",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Utsending</h1>
          <p className="text-muted-foreground">
            Send SMS til grupper eller enkeltpersoner
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Ny melding
            </TabsTrigger>
            <TabsTrigger value="campaign" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Kampanje
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Historikk
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Maler
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Mottakere</CardTitle>
                    <CardDescription>Velg hvem som skal motta meldingen</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label>Velg grupper og kontakter</Label>
                      <div className="border rounded-md p-3 max-h-[400px] overflow-y-auto space-y-2">
                        {groups.map(group => {
                          const isSelected = isGroupSelected(group.id);
                          const isExpanded = expandedGroups.has(group.id);
                          const selectedCount = getSelectedContactCount(group.id);
                          const totalCount = getTotalContactCount(group.id);
                          const contacts = groupContacts.get(group.id) || [];

                          return (
                            <div key={group.id} className="space-y-2">
                              {/* Group checkbox */}
                              <div className="flex items-center gap-2 p-2 hover:bg-secondary/50 rounded">
                                <Checkbox 
                                  id={`g-${group.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleGroup(group.id)}
                                />
                                <button
                                  onClick={() => {
                                    if (isSelected) toggleGroupExpansion(group.id);
                                  }}
                                  disabled={!isSelected}
                                  className="flex items-center gap-1 flex-1 text-left disabled:opacity-50"
                                >
                                  {isSelected && (isExpanded ? 
                                    <ChevronDown className="h-4 w-4" /> : 
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <Label htmlFor={`g-${group.id}`} className="cursor-pointer flex-1">
                                    {group.name}
                                  </Label>
                                </button>
                                <div className="flex items-center gap-2">
                                  {isSelected && selectedCount > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {selectedCount} av {totalCount}
                                    </Badge>
                                  )}
                                  {!isSelected && (
                                    <Badge variant="outline" className="text-xs">
                                      {group.active_members || 0}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Contact list (shown when group is selected and expanded) */}
                              {isSelected && isExpanded && (
                                <div className="ml-6 pl-4 border-l-2 border-secondary space-y-2">
                                  {/* "Select all" checkbox */}
                                  {contacts.length > 0 && (
                                    <div className="flex items-center gap-2 p-1">
                                      <Checkbox
                                        id={`all-${group.id}`}
                                        checked={areAllContactsSelected(group.id)}
                                        onCheckedChange={() => toggleAllContacts(group.id)}
                                      />
                                      <Label htmlFor={`all-${group.id}`} className="cursor-pointer font-medium text-sm">
                                        Velg alle kontakter ({contacts.length})
                                      </Label>
                                    </div>
                                  )}

                                  {/* Individual contacts */}
                                  {contacts.length > 0 ? (
                                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                      {contacts.map(contact => (
                                        <div key={contact.id} className="flex items-center gap-2 p-1 hover:bg-secondary/30 rounded">
                                          <Checkbox
                                            id={`c-${contact.id}`}
                                            checked={isContactSelected(group.id, contact.id)}
                                            onCheckedChange={() => toggleContact(group.id, contact.id)}
                                          />
                                          <Label htmlFor={`c-${contact.id}`} className="cursor-pointer flex-1 text-sm">
                                            {contact.name || "Ukjent"}
                                          </Label>
                                          <span className="text-xs text-muted-foreground">
                                            {contact.phone}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic p-2">
                                      Denne gruppen har ingen kontakter ennå
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Innstillinger</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="urgent" className="flex flex-col space-y-1">
                        <span>Haste-melding</span>
                        <span className="font-normal text-xs text-muted-foreground">Markeres som viktig og prioriteres</span>
                      </Label>
                      <Switch 
                        id="urgent" 
                        checked={isUrgent}
                        onCheckedChange={setIsUrgent}
                      />
                    </div>
                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="ack" className="flex flex-col space-y-1">
                        <span>Krev bekreftelse</span>
                        <span className="font-normal text-xs text-muted-foreground">Mottakere må svare OK</span>
                      </Label>
                      <Switch 
                        id="ack" 
                        checked={requireAck}
                        onCheckedChange={setRequireAck}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Planlegg utsending (valgfritt)</Label>
                      <Input 
                        type="datetime-local" 
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle>Innhold</CardTitle>
                    <CardDescription>Skriv meldingen din her</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <Textarea 
                      placeholder="Skriv din melding..." 
                      className="min-h-[200px] resize-none text-lg"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{message.length} tegn</span>
                      <span>{Math.ceil(message.length / 160)} SMS</span>
                    </div>
                    
                    <div className="bg-secondary/30 p-4 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Forhåndsvisning</h4>
                      <div className="bg-white dark:bg-slate-950 p-3 rounded border max-w-[300px] shadow-sm">
                        <p className="text-sm whitespace-pre-wrap">{message || "Din melding vises her..."}</p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" size="lg" onClick={handleSend} disabled={loading}>
                      {loading ? (
                        <span className="flex items-center gap-2">Sender...</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          {scheduleDate ? "Planlegg utsending" : "Send melding nå"}
                        </span>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="campaign" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Opprett Kampanje</CardTitle>
                <CardDescription>
                  Lag en bulk-kampanje for å sende meldinger til mange mottakere samtidig
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Kampanjenavn</Label>
                      <Input placeholder="F.eks: Julekampanje 2026" />
                    </div>
                    <div className="space-y-2">
                      <Label>Velg gruppe</Label>
                      <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                        {groups.map(group => (
                          <div key={group.id} className="flex items-center gap-2 p-2 hover:bg-secondary/50 rounded">
                            <Checkbox id={`camp-${group.id}`} />
                            <Label htmlFor={`camp-${group.id}`} className="cursor-pointer flex-1">
                              {group.name}
                            </Label>
                            <Badge variant="outline" className="text-xs">
                              {group.active_members || 0}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Melding</Label>
                      <Textarea 
                        placeholder="Skriv kampanjemelding..." 
                        className="min-h-[150px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" variant="outline">
                        Lagre som utkast
                      </Button>
                      <Button className="flex-1">
                        <Megaphone className="h-4 w-4 mr-2" />
                        Send kampanje
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aktive kampanjer</CardTitle>
                <CardDescription>Oversikt over dine kampanjer</CardDescription>
              </CardHeader>
              <CardContent>
                {campaignLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Laster kampanjer...
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Ingen kampanjer funnet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map((campaign) => (
                      <div 
                        key={campaign.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50"
                      >
                        <div className="space-y-1">
                          <h4 className="font-medium">{campaign.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {campaign.total_recipients} mottakere
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={
                            campaign.status === "completed" ? "default" :
                            campaign.status === "sending" ? "secondary" :
                            campaign.status === "failed" ? "destructive" : 
                            "outline"
                          }>
                            {campaign.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              loadCampaignDetails(campaign.id);
                              setCampaignDetailDialogOpen(true);
                            }}
                          >
                            Se detaljer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Utsendingshistorikk</CardTitle>
                <CardDescription>Tidligere kampanjer og utsendinger</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    {campaignLoading ? (
                      <div className="text-muted-foreground">Laster kampanjer...</div>
                    ) : campaigns.length === 0 ? (
                      <div className="text-muted-foreground">Ingen utsendinger funnet</div>
                    ) : (
                      campaigns.map((campaign: CampaignHistory) => (
                        <button
                          key={campaign.id}
                          className={`w-full text-left border rounded-md p-3 transition ${
                            selectedCampaignId === campaign.id ? "border-primary bg-primary/5" : "hover:bg-secondary/40"
                          }`}
                          onClick={() => loadCampaignDetails(campaign.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{campaign.name || "Uten navn"}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(campaign.created_at).toLocaleString("nb-NO")}
                              </p>
                            </div>
                            <Badge variant={campaign.status === "completed" ? "default" : "outline"}>
                              {campaign.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {campaign.total_recipients} mottakere • {campaign.sent_count || 0} sendt • {campaign.failed_count || 0} feilet
                          </p>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="border rounded-md p-3 min-h-[320px]">
                    {!selectedCampaignId ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Velg en utsending for å se status og sende påminnelse.
                      </div>
                    ) : historyLoading ? (
                      <div className="text-sm text-muted-foreground">Laster detaljer...</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h3 className="font-semibold">{selectedCampaign?.name}</h3>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {selectedCampaign?.message_template}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-y py-2">
                          <div className="text-sm text-muted-foreground">
                            {campaignInboundMessages.length} har svart • {nonResponders.length} mangler svar
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setReminderDialogOpen(true)}
                            disabled={selectedForReminder.length === 0}
                          >
                            Send påminnelse til {selectedForReminder.length} valgte
                          </Button>
                        </div>

                        {nonResponders.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedForReminder.length === nonResponders.length && nonResponders.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedForReminder(nonResponders.map((r) => r.id));
                                } else {
                                  setSelectedForReminder([]);
                                }
                              }}
                            />
                            <span>Velg alle uten svar</span>
                          </div>
                        )}

                        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                          {campaignRecipients.map((recipient) => {
                            const replied = hasResponded(recipient.phone);
                            const reminder = getLatestReminder(recipient.phone);
                            return (
                              <div key={recipient.id} className="border rounded p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedForReminder.includes(recipient.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedForReminder((prev) => [...prev, recipient.id]);
                                        } else {
                                          setSelectedForReminder((prev) => prev.filter((id) => id !== recipient.id));
                                        }
                                      }}
                                      disabled={replied}
                                    />
                                    <div className="flex flex-col">
                                      {recipient.name && (
                                        <span className="text-sm font-medium">{recipient.name}</span>
                                      )}
                                      <span className="text-xs text-muted-foreground">{recipient.phone}</span>
                                    </div>
                                  </div>
                                  {replied ? (
                                    <Badge className="bg-green-600 text-white">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Har svart
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Ingen respons
                                    </Badge>
                                  )}
                                </div>
                                {reminder && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    Påminnelse sendt {new Date(reminder.created_at).toLocaleString("nb-NO")}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Meldingsmaler</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {["Kalle inn til vakt", "Systemvarsel", "Påminnelse møte"].map((t, i) => (
                    <Card key={i} className="cursor-pointer hover:border-primary transition-colors" onClick={() => {
                      setMessage(`Hei, dette er en mal for ${t}...`);
                      setActiveTab("compose");
                    }}>
                      <CardHeader className="p-4">
                        <CardTitle className="text-base">{t}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
                        Klikk for å bruke denne malen...
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={campaignDetailDialogOpen} onOpenChange={setCampaignDetailDialogOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* ── Header ── */}
          {/* pr-14 keeps content clear of the absolutely-positioned Radix close button (right-4 top-4) */}
          <div className="pl-6 pr-14 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold leading-none">
                    {selectedCampaign?.name || "Kampanjedetaljer"}
                  </h2>
                  {selectedCampaign && (
                    <Badge variant={campaignStatusVariant(selectedCampaign.status)}>
                      {campaignStatusLabel(selectedCampaign.status)}
                    </Badge>
                  )}
                </div>
                {selectedCampaign && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Sendt {fmtTime(selectedCampaign.created_at)}
                  </p>
                )}
              </div>
              {/* Dynamic reminder button */}
              <Button
                size="sm"
                className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white"
                disabled={selectedForReminder.length === 0 || historyLoading}
                onClick={() => {
                  setCampaignDetailDialogOpen(false);
                  setReminderDialogOpen(true);
                }}
              >
                Send påminnelse til {selectedForReminder.length} valgte
              </Button>
            </div>
          </div>

          {historyLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-12">
              Laster detaljer...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* ── Original message box ── */}
              <div className="px-6 py-4 border-b bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Kampanjemelding
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedCampaign?.message_template || "–"}
                </p>
              </div>

              {/* ── Recipient overview ── */}
              <div className="px-6 py-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Mottakeroversikt ({campaignRecipients.length})
                </p>

                {campaignRecipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen mottakere funnet.</p>
                ) : (
                  // Non-responders first, then replied
                  [...campaignRecipients]
                    .sort((a, b) => {
                      const aReplied = hasResponded(a.phone);
                      const bReplied = hasResponded(b.phone);
                      if (aReplied === bReplied) return 0;
                      return aReplied ? 1 : -1;
                    })
                    .map((recipient) => {
                    const replied = hasResponded(recipient.phone);
                    const outMsg = getOutboundMessage(recipient.phone);
                    const inMsg = getInboundReply(recipient.phone);
                    const isChecked = selectedForReminder.includes(recipient.id);
                    const reminders = getReminders(recipient.phone);

                    return (
                      <div
                        key={recipient.id}
                        className={`rounded-md border px-2.5 py-1.5 ${
                          replied
                            ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                            : "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20"
                        }`}
                      >
                        {/* Main row: checkbox + name + phone + badge */}
                        <div className="flex items-center gap-2">
                          {!replied && (
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedForReminder((prev) => [...prev, recipient.id]);
                                } else {
                                  setSelectedForReminder((prev) => prev.filter((id) => id !== recipient.id));
                                }
                              }}
                            />
                          )}
                          <span className="text-sm font-medium leading-none">
                            {recipient.name || recipient.phone}
                          </span>
                          {recipient.name && (
                            <span className="text-xs text-muted-foreground">{recipient.phone}</span>
                          )}
                          <div className="flex-1" />
                          {replied ? (
                            <Badge className="bg-green-600 text-white shrink-0 text-[11px] py-0 px-1.5 h-5">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Svart
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-500 text-white shrink-0 text-[11px] py-0 px-1.5 h-5">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Ingen respons
                            </Badge>
                          )}
                        </div>

                        {/* Compact metadata row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0 mt-0.5 text-[11px] text-muted-foreground leading-5">
                          {outMsg && (
                            <>
                              <span className="flex items-center gap-0.5">
                                <ArrowUpRight className="h-3 w-3 text-blue-400" />
                                <span className="font-mono">{shortId(outMsg)}</span>
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Send className="h-3 w-3" />
                                {fmtTime(outMsg.created_at)}
                              </span>
                            </>
                          )}
                          {replied && inMsg ? (
                            <>
                              <span className="flex items-center gap-0.5">
                                <ArrowDownLeft className="h-3 w-3 text-green-500" />
                                <span className="font-mono">{shortId(inMsg)}</span>
                              </span>
                              <span className="flex items-center gap-0.5">
                                <ArrowDownLeft className="h-3 w-3 text-green-500" />
                                {fmtTime(inMsg.created_at)}
                              </span>
                            </>
                          ) : (
                            <span className="flex items-center gap-0.5 text-orange-500 dark:text-orange-400">
                              <Clock className="h-3 w-3" />
                              Venter på svar
                            </span>
                          )}
                        </div>

                        {/* Reply text */}
                        {replied && inMsg && (
                          <div className="mt-1 border-l-2 border-green-400 pl-2 ml-0.5">
                            <p className="text-xs text-muted-foreground italic">{inMsg.content || "–"}</p>
                          </div>
                        )}

                        {/* Reminders */}
                        {reminders.map((reminder) => (
                          <div key={reminder.id} className="mt-1 border-l-2 border-orange-300 pl-2 ml-0.5">
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <MessageSquare className="h-3 w-3 text-orange-400 shrink-0" />
                              Påminnelse {fmtTime(reminder.created_at)}: {reminder.content || "–"}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          {!historyLoading && (
            <div className="px-6 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
              {nonResponders.length === 0
                ? "Alle mottakere har svart."
                : `${nonResponders.length} mottaker${nonResponders.length === 1 ? "" : "e"} har ikke svart ennå.`}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send påminnelse</DialogTitle>
            <DialogDescription>
              Påminnelsen sendes til {selectedForReminder.length} mottaker{selectedForReminder.length === 1 ? "" : "e"} uten svar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <p className="text-sm font-medium">Mottakere</p>
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {campaignRecipients
                .filter((r) => selectedForReminder.includes(r.id))
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      {r.name && <span className="font-medium">{r.name} </span>}
                      <span className="text-muted-foreground">{r.phone}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Ingen respons
                    </Badge>
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Påminnelsestekst</p>
            <Textarea
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              placeholder="Skriv påminnelse..."
              className="min-h-[120px]"
              disabled={sendingReminder}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={sendingReminder}
              onClick={() => {
                setReminderDialogOpen(false);
                setReminderMessage("");
              }}
            >
              Avbryt
            </Button>
            <Button disabled={sendingReminder || !reminderMessage.trim()} onClick={handleSendReminder}>
              {sendingReminder ? "Sender..." : `Send til ${selectedForReminder.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
