import React, { useEffect, useState } from "react";
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
  Phone,
  Clock,
  CheckCheck,
  Inbox as InboxIcon,
  AlertTriangle,
  FolderInput,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  messageService, 
  type Message, 
  type MessageThread,
  type ExtendedMessageThread 
} from "@/services/messageService";
import { groupService, type Group } from "@/services/groupService";
import { supabase } from "@/integrations/supabase/client";

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<"all" | "fallback" | "escalated">("all");
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

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  // Filter threads based on search query
  const filteredThreads = threads.filter((thread) => {
    const matchesSearch = 
      thread.contact_phone.includes(searchQuery) || 
      (thread.group_name && thread.group_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (thread.last_message_content && thread.last_message_content.toLowerCase().includes(searchQuery.toLowerCase()));
      
    // Filter by view mode
    if (viewMode === "all") return matchesSearch;
    if (viewMode === "fallback") return matchesSearch && thread.is_fallback;
    if (viewMode === "escalated") return matchesSearch; // Escalated view logic handles fetching
    if (viewMode === "resolved") return matchesSearch && thread.is_resolved;
    
    // For specific group view
    return matchesSearch && thread.resolved_group_id === viewMode;
  });

  useEffect(() => {
    loadGroups();
    loadThreads();

    // Subscribe to realtime updates for messages
    const channel = supabase
      .channel("inbox_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadThreads();
          if (selectedThread) {
            loadMessages(selectedThread.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, selectedGroupFilter]);

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.id);
    }
  }, [selectedThread]);

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

      // Filter by group if selected
      if (selectedGroupFilter !== "all") {
        loadedThreads = loadedThreads.filter(
          (t) => t.resolved_group_id === selectedGroupFilter
        );
      }

      setThreads(loadedThreads);

      // Preserve selection if still valid, or select first
      if (loadedThreads.length > 0) {
        if (!selectedThread || !loadedThreads.find(t => t.id === selectedThread.id)) {
          setSelectedThread(loadedThreads[0]);
        }
      } else {
        setSelectedThread(null);
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
      setMessages(threadMessages);
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
        "+47 900 00 000", // TODO: Get from gateway config
        selectedThread.id
      );

      setNewMessage("");
      // Message update handled by subscription
    } catch (error) {
      console.error("Failed to send reply:", error);
      alert("Kunne ikke sende melding");
    } finally {
      setSending(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedThread) return;

    try {
      await messageService.acknowledgeThread(selectedThread.id);
      // Updates handled by subscription
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
      // Updates handled by subscription, but force reload to be safe
      await loadThreads();
    } catch (error) {
      console.error("Failed to reclassify thread:", error);
      alert("Kunne ikke omklassifisere samtale");
    }
  };

  const handleResolve = async () => {
    if (!selectedThread) return;

    try {
      await messageService.resolveThread(selectedThread.id);
      setSelectedThread(null);
      await loadThreads();
    } catch (error) {
      console.error("Failed to resolve thread:", error);
      alert("Kunne ikke løse samtale");
    }
  };

  const hasUnacknowledged = messages.some((m) => m.direction === "inbound" && !m.is_acknowledged);

  return (
    <>
      <Head>
        <title>Innboks | SeMSe</title>
        <meta name="description" content="Behandle innkommende meldinger" />
      </Head>

      <AppLayout>
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
          <div className="flex-none">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Innboks</h2>
            <p className="text-muted-foreground mt-2">
              Håndter meldinger fra dine grupper. Kun meldinger fra grupper du er vakt i vises her.
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
                      Samtaler ({threads.length})
                    </CardTitle>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                      {loading ? (
                        <p className="text-muted-foreground text-center py-8 text-sm">Laster...</p>
                      ) : threads.length === 0 ? (
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
                        threads.map((thread) => (
                          <button
                            key={thread.id}
                            onClick={() => setSelectedThread(thread)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                              selectedThread?.id === thread.id
                                ? "bg-primary/5 border-primary/50 shadow-sm"
                                : "bg-card hover:bg-accent/50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-semibold text-sm truncate">{thread.contact_phone}</span>
                                  {thread.unread_count > 0 && (
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
                                  <span className="font-medium text-foreground/80">{thread.group_name}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(thread.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              Gruppe: <span className="font-medium text-foreground">{selectedThread.group_name}</span>
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {selectedThread.is_fallback && (
                              <Button
                                onClick={() => setReclassifyDialogOpen(true)}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                              >
                                <FolderInput className="h-4 w-4" />
                                <span className="hidden sm:inline">Omklassifiser</span>
                              </Button>
                            )}
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

                      <ScrollArea className="flex-1 p-4 bg-slate-50 dark:bg-slate-950/20">
                        <div className="space-y-4">
                          {messages.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8 text-sm">Ingen meldinger</p>
                          ) : (
                            messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={cn(
                                  "flex flex-col max-w-[85%] mb-4",
                                  msg.direction === "outbound" ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                              >
                                <div
                                  className={cn(
                                    "rounded-2xl px-4 py-2 text-sm shadow-sm",
                                    msg.direction === "outbound"
                                      ? "bg-blue-600 text-white rounded-br-none"
                                      : "bg-white dark:bg-card border text-foreground rounded-bl-none"
                                  )}
                                >
                                  {msg.is_fallback && msg.direction === "inbound" && (
                                    <div className="mb-1 pb-1 border-b border-border/10 flex items-center gap-1 text-xs opacity-90">
                                       <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                       <span>Ukjent avsender</span>
                                    </div>
                                  )}
                                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(msg.created_at).toLocaleString("no-NO", {
                                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                  </span>
                                  {msg.direction === "inbound" && msg.is_acknowledged && (
                                    <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                                      <CheckCheck className="h-3 w-3" />
                                      <span>Mottatt</span>
                                    </div>
                                  )}
                                  {msg.direction === "inbound" && !msg.is_acknowledged && (
                                    <span className="text-[10px] text-amber-600 font-medium animate-pulse">
                                      Ubehandlet
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
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
                            placeholder="Skriv svar..."
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
            <DialogTitle>Omklassifiser samtale</DialogTitle>
            <DialogDescription>
              Flytt denne samtalen til en annen gruppe. Meldingen vil forsvinne fra "Ukjente avsendere" og vises i den valgte gruppens innboks.
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
              Omklassifiser og flytt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}