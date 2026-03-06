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
import { Send, Clock, FileText, ChevronDown, ChevronRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bulkService } from "@/services/bulkService";
import { groupService, type Group as ServiceGroup } from "@/services/groupService";
import { contactService, type Contact } from "@/services/contactService";
import { messageService } from "@/services/messageService";

const db = supabase as any;

type GroupSelection = {
  groupId: string;
  selectedContactIds: string[];
};

export default function SendingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("compose");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  
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
    } catch (error) {
      console.error("Error loading data:", error);
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

      const campaign = await bulkService.createBulkCampaign({
        name: `Melding til ${groupNames}`,
        message_template: message,
        total_recipients: totalRecipients,
        status: scheduleDate ? "scheduled" : "processing",
        tenant_id: profile.tenant_id,
        created_by: profile.id,
        group_id: selectedGroups[0].groupId,
        started_at: scheduleDate ? undefined : new Date().toISOString()
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

        // Update campaign status
        await db
          .from("bulk_campaigns")
          .update({
            status: successCount === totalRecipients ? "completed" : "partial",
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

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Utsendingshistorikk</CardTitle>
                <CardDescription>Tidligere kampanjer og utsendinger</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Ingen utsendinger funnet
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
    </AppLayout>
  );
}