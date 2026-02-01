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
  Phone,
  Clock,
  CheckCheck,
  Inbox as InboxIcon,
  AlertTriangle,
  FolderInput,
  Archive,
  ArrowRight,
  ArrowLeft,
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

// Grouped conversation type (one per phone number)
interface GroupedConversation {
  contact_phone: string;
  group_name: string;
  resolved_group_id: string;
  last_message_at: string;
  last_message_content: string;
  unread_count: number;
  is_fallback: boolean;
  thread_ids: string[]; // All thread IDs for this phone number
}

// Hjelpefunksjon for datoformatering
const formatMessageTime = (dateString: string) => {
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
  const [activeTab, setActiveTab] = useState<"all" | "fallback" | "escalated">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [threads, setThreads] = useState<ExtendedMessageThread[]>([]);
  const [groupedConversations, setGroupedConversations] = useState<GroupedConversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");

  // Reclassification dialog state
  const [reclassifyDialogOpen, setReclassifyDialogOpen] = useState(false);
  const [reclassifyTargetGroup, setReclassifyTargetGroup] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = groupedConversations.find((c) => c.contact_phone === selectedPhoneNumber);

  // Filter conversations based on search query
  const filteredConversations = groupedConversations.filter((conv) => {
    const matchesSearch = 
      conv.contact_phone.includes(searchQuery) || 
      (conv.group_name && conv.group_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.last_message_content && conv.last_message_content.toLowerCase().includes(searchQuery.toLowerCase()));
      
    // Filter by view mode
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "fallback") return matchesSearch && conv.is_fallback;
    if (activeTab === "escalated") return matchesSearch;
    
    return matchesSearch && conv.resolved_group_id === selectedGroupFilter;
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
          if (selectedPhoneNumber) {
            loadMessagesForPhone(selectedPhoneNumber);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, selectedGroupFilter]);

  useEffect(() => {
    if (selectedPhoneNumber) {
      loadMessagesForPhone(selectedPhoneNumber);
    }
  }, [selectedPhoneNumber]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

      // Group threads by contact_phone
      const grouped = groupThreadsByPhone(loadedThreads);
      setGroupedConversations(grouped);

      // Auto-select first conversation if none selected
      if (grouped.length > 0) {
        if (!selectedPhoneNumber || !grouped.find(c => c.contact_phone === selectedPhoneNumber)) {
          setSelectedPhoneNumber(grouped[0].contact_phone);
        }
      } else {
        setSelectedPhoneNumber(null);
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    } finally {
      setLoading(false);
    }
  };

  const groupThreadsByPhone = (threads: ExtendedMessageThread[]): GroupedConversation[] => {
    const phoneMap = new Map<string, ExtendedMessageThread[]>();

    // Group threads by phone number
    threads.forEach(thread => {
      const existing = phoneMap.get(thread.contact_phone) || [];
      existing.push(thread);
      phoneMap.set(thread.contact_phone, existing);
    });

    // Create grouped conversations
    const grouped: GroupedConversation[] = [];
    phoneMap.forEach((phoneThreads, phone) => {
      // Sort by last_message_at to get the most recent
      phoneThreads.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );

      const mostRecent = phoneThreads[0];
      const totalUnread = phoneThreads.reduce((sum, t) => sum + t.unread_count, 0);
      const isFallback = phoneThreads.some(t => t.is_fallback);

      grouped.push({
        contact_phone: phone,
        group_name: mostRecent.group_name,
        resolved_group_id: mostRecent.resolved_group_id,
        last_message_at: mostRecent.last_message_at,
        last_message_content: mostRecent.last_message_content,
        unread_count: totalUnread,
        is_fallback: isFallback,
        thread_ids: phoneThreads.map(t => t.id),
      });
    });

    // Sort by last message time (newest first)
    grouped.sort((a, b) => 
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );

    return grouped;
  };

  const loadMessagesForPhone = async (phoneNumber: string) => {
    try {
      // Get all threads for this phone number
      const phoneThreads = threads.filter(t => t.contact_phone === phoneNumber);
      const threadIds = phoneThreads.map(t => t.id);

      // Load messages from all threads for this phone number
      const allMessages: Message[] = [];
      for (const threadId of threadIds) {
        const threadMessages = await messageService.getMessagesByThread(threadId);
        allMessages.push(...threadMessages);
      }

      // Sort by created_at (newest first for mobile-like display)
      allMessages.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setMessages(allMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleSendReply = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      setSending(true);

      // Use the first thread for this phone number to send the reply
      const firstThreadId = selectedConversation.thread_ids[0];

      await messageService.sendMessage(
        newMessage,
        selectedConversation.contact_phone,
        "+47 900 00 000",
        firstThreadId
      );

      setNewMessage("");
    } catch (error) {
      console.error("Failed to send reply:", error);
      alert("Kunne ikke sende melding");
    } finally {
      setSending(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedConversation) return;

    try {
      // Acknowledge all threads for this phone number
      for (const threadId of selectedConversation.thread_ids) {
        await messageService.acknowledgeThread(threadId);
      }
    } catch (error) {
      console.error("Failed to acknowledge thread:", error);
    }
  };

  const handleReclassify = async () => {
    if (!selectedConversation || !reclassifyTargetGroup) return;

    try {
      // Reclassify all threads for this phone number
      for (const threadId of selectedConversation.thread_ids) {
        await messageService.reclassifyThread(threadId, reclassifyTargetGroup);
      }
      setReclassifyDialogOpen(false);
      setReclassifyTargetGroup("");
      await loadThreads();
    } catch (error) {
      console.error("Failed to reclassify thread:", error);
      alert("Kunne ikke omklassifisere samtale");
    }
  };

  const handleResolve = async () => {
    if (!selectedConversation) return;

    try {
      // Resolve all threads for this phone number
      for (const threadId of selectedConversation.thread_ids) {
        await messageService.resolveThread(threadId);
      }
      setSelectedPhoneNumber(null);
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
        <title>Samtaler | SeMSe</title>
        <meta name="description" content="Behandle innkommende og utgående meldinger" />
      </Head>

      <AppLayout>
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
          <div className="flex-none">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Samtaler</h2>
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
                {/* Conversation List (Grouped by Phone Number) */}
                <Card className="lg:col-span-1 flex flex-col h-full overflow-hidden">
                  <CardHeader className="border-b py-3 px-4 flex-none">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Samtaler ({groupedConversations.length})
                    </CardTitle>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                      {loading ? (
                        <p className="text-muted-foreground text-center py-8 text-sm">Laster...</p>
                      ) : groupedConversations.length === 0 ? (
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
                        groupedConversations.map((conv) => (
                          <button
                            key={conv.contact_phone}
                            onClick={() => setSelectedPhoneNumber(conv.contact_phone)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                              selectedPhoneNumber === conv.contact_phone
                                ? "bg-primary/5 border-primary/50 shadow-sm"
                                : "bg-card hover:bg-accent/50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-semibold text-sm truncate">{conv.contact_phone}</span>
                                  {conv.unread_count > 0 && (
                                    <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                      {conv.unread_count}
                                    </Badge>
                                  )}
                                  {conv.is_fallback && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 border-yellow-500 text-yellow-600">
                                      Ukjent
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <span className="font-medium text-foreground/80">{conv.group_name}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(conv.last_message_at).toLocaleTimeString("no-NO", {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate line-clamp-1">
                                  {conv.last_message_content}
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
                  {selectedConversation ? (
                    <>
                      <CardHeader className="border-b py-3 px-6 flex-none bg-muted/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                              {selectedConversation.contact_phone}
                              {selectedConversation.is_fallback && (
                                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                                  Ukjent avsender
                                </Badge>
                              )}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              Gruppe: <span className="font-medium text-foreground">{selectedConversation.group_name}</span>
                            </p>
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
                            // Reverse to show oldest first (like a chat), newest at bottom
                            [...messages].reverse().map((msg) => (
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
                <span className="font-mono">{selectedConversation?.contact_phone}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span>Mottatt i:</span>
                <span className="font-medium">{selectedConversation?.group_name}</span>
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
                    .filter((g) => g.id !== selectedConversation?.resolved_group_id)
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