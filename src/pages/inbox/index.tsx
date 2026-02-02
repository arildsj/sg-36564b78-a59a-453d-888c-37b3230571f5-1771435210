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
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  messageService, 
  type Message, 
  type ExtendedMessageThread 
} from "@/services/messageService";
import { groupService, type Group } from "@/services/groupService";
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
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");

  // Reclassification dialog state
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
        loadedThreads = await messageService.getAllThreads();
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
    try {
      const threadMessages = await messageService.getMessagesByThread(threadId);
      
      // Sort by created_at (oldest first - chronological order like traditional chat)
      threadMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setMessages(threadMessages);
      
      // Scroll to bottom after messages are loaded
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
        selectedThread.id
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
            className="flex-1 flex flex-col space-y-4"
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

            <TabsContent value={activeTab} className="flex-1 m-0 min-h-0">
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
                          <p className="text-muted-foreground font-medium">Ingen samtaler</p>
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
                                  <span className="font-semibold text-sm truncate">{thread.contact_phone}</span>
                                  {(thread.unread_count || 0) > 0 && (
                                    <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                      {thread.unread_count}
                                    </Badge>
                                  )}
                                  {thread.is_fallback && (
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
                    <>
                      <CardHeader className="border-b py-3 px-6 flex-none bg-muted/10">
                        <div className="flex items-center justify-between">
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
                                  {/* Debug info - can be removed later */}
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
    </>
  );
}