import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Send, Smartphone, Users, Clock, AlertTriangle, FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bulkService, type BulkCampaign } from "@/services/bulkService";
import { groupService, type Group as ServiceGroup } from "@/services/groupService";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export default function SendingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("compose");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  // Form states
  const [message, setMessage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [requireAck, setRequireAck] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch operational groups
      const groupsData = await groupService.getOperationalGroups();
      setGroups(groupsData);

      // Fetch templates (mock or real)
      // const templatesData = await messageService.getTemplates();
      // setTemplates(templatesData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
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
        description: "Velg minst én mottakergruppe",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Expand groups to phone numbers (naive implementation)
      // Ideally this happens on backend via Bulk Service
      
      const { data: user } = await supabase.auth.getUser();
      
      // Calculate total recipients (estimation)
      const totalRecipients = groups
        .filter(g => selectedGroups.includes(g.id))
        .reduce((acc, g) => acc + (g.active_members || 0), 0);

      const campaign = await bulkService.createCampaign({
        name: `Melding til ${selectedGroups.length} grupper`,
        message_body: message,
        total_recipients: totalRecipients, // This is just an estimate
        scheduled_at: scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
      });

      // Add groups to campaign context (if we had a table for it)
      // For now we assume the backend handles expansion based on some logic, 
      // or we insert into bulk_recipients here.
      
      // Let's manually trigger expansion via Edge Function if available, 
      // or just simulate success for the UI prototype.
      
      if (!scheduleDate) {
        await bulkService.triggerCampaign(campaign.id);
      }

      toast({
        title: scheduleDate ? "Melding planlagt" : "Melding sendt",
        description: scheduleDate 
          ? `Meldingen sendes ${new Date(scheduleDate).toLocaleString()}`
          : `Meldingen sendes til ca ${totalRecipients} mottakere nå`,
      });

      // Reset form
      setMessage("");
      setSelectedGroups([]);
      setScheduleDate("");
      setIsUrgent(false);
      setRequireAck(false);
      setActiveTab("history");

    } catch (error: any) {
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
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Velg grupper</Label>
                        <div className="grid grid-cols-1 gap-2 border rounded-md p-2 max-h-[200px] overflow-y-auto">
                          {groups.map(group => (
                            <div key={group.id} className="flex items-center space-x-2 p-1 hover:bg-secondary/50 rounded">
                              <Checkbox 
                                id={`g-${group.id}`}
                                checked={selectedGroups.includes(group.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedGroups([...selectedGroups, group.id]);
                                  else setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                                }}
                              />
                              <Label htmlFor={`g-${group.id}`} className="flex-1 cursor-pointer flex justify-between">
                                <span>{group.name}</span>
                                <Badge variant="secondary" className="text-xs">{group.active_members || 0}</Badge>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Placeholder for whitelisted numbers (needs proper implementation) */}
                      {/* <div className="space-y-2">
                         <Label>Eller skriv inn nummer (whitelist sjekk)</Label>
                         <Input placeholder="+47..." />
                      </div> */}
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
                  {/* Mock templates */}
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

// Missing component definition for Switch (was implicitly imported or just standard UI)
import { Switch } from "@/components/ui/switch";