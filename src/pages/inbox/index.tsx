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
import { messageService, type MessageThread, type Message } from "@/services/messageService";
import { groupService } from "@/services/groupService";
import { supabase } from "@/integrations/supabase/client";

type Group = {
  id: string;
  name: string;
};

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<"all" | "fallback" | "escalated">("all");
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");

  // Reclassification dialog state
  const [reclassifyDialogOpen, setReclassifyDialogOpen] = useState(false);
  const [reclassifyTargetGroup, setReclassifyTargetGroup] = useState<string>("");

  useEffect(() => {
    loadGroups();
    loadThreads();
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
      let loadedThreads: MessageThread[] = [];

      if (activeTab === "all") {
        loadedThreads = await messageService.getAllThreads();
      } else if (activeTab === "fallback") {
        loadedThreads = await messageService.getFallbackThreads();
      } else if (activeTab === "escalated") {
        const escalated = await messageService.getEscalatedThreads(30);
        // Convert escalated messages to thread format
        const threadMap = new Map<string, MessageThread>();
        escalated.forEach((msg: any) => {
          const thread = msg.message_threads;
          if (!threadMap.has(thread.id)) {
            threadMap.set(thread.id, {
              id: thread.id,
              contact_phone: thread.contact_phone,
              resolved_group_id: thread.resolved_group_id,
              is_resolved: false,
              last_message_at: msg.created_at,
              created_at: msg.created_at,
              group_name: thread.groups?.name || "Unknown",
              unread_count: 1,
              last_message_content: msg.content,
              is_fallback: false,
            });
          }
        });
        loadedThreads = Array.from(threadMap.values());
      }

      // Filter by group if selected
      if (selectedGroupFilter !== "all") {
        loadedThreads = loadedThreads.filter(
          (t) => t.resolved_group_id === selectedGroupFilter
        );
      }

      setThreads(loadedThreads);

      // Auto-select first thread
      if (loadedThreads.length > 0 && !selectedThread) {
        setSelectedThread(loadedThreads[0]);
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
    if (!replyText.trim() || !selectedThread) return;

    try {
      setSending(true);

      await messageService.sendMessage(
        replyText,
        selectedThread.contact_phone,
        "+47 900 00 000", // TODO: Get from gateway config
        selectedThread.id
      );

      setReplyText("");
      await loadMessages(selectedThread.id);
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
      await loadThreads();
      if (selectedThread) {
        await loadMessages(selectedThread.id);
      }
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
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Innboks</h2>
            <p className="text-muted-foreground mt-2">
              Håndter meldinger fra dine grupper. Kun meldinger fra grupper du er vakt i vises her.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
            <div className="flex items-center justify-between">
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

            <TabsContent value={activeTab} className="m-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-20rem)]">
                {/* Thread List */}
                <Card className="lg:col-span-1 flex flex-col">
                  <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Samtaler ({threads.length})
                    </CardTitle>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-2">
                      {loading ? (
                        <p className="text-muted-foreground text-center py-8">Laster...</p>
                      ) : threads.length === 0 ? (
                        <div className="text-center py-12">
                          <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                          <p className="text-muted-foreground">Ingen samtaler</p>
                          <p className="text-sm text-muted-foreground mt-2">
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
                              "w-full text-left p-4 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                              selectedThread?.id === thread.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card hover:bg-accent"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold truncate">{thread.contact_phone}</p>
                                  {thread.unread_count > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                      {thread.unread_count} ny
                                    </Badge>
                                  )}
                                  {thread.is_fallback && (
                                    <Badge variant="outline" className="text-xs">
                                      Ukjent
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm opacity-90 flex items-center gap-1 mt-1">
                                  <Phone className="h-3 w-3" />
                                  {thread.contact_phone}
                                </p>
                                <p className="text-xs opacity-75 mt-1">{thread.group_name}</p>
                                <p className="text-sm mt-2 truncate opacity-80">
                                  {thread.last_message_content}
                                </p>
                                <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(thread.last_message_at).toLocaleString("no-NO")}
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
                <Card className="lg:col-span-2 flex flex-col">
                  {selectedThread ? (
                    <>
                      <CardHeader className="border-b">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {selectedThread.contact_phone}
                              {selectedThread.is_fallback && (
                                <Badge variant="outline">Ukjent avsender</Badge>
                              )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {selectedThread.contact_phone} • {selectedThread.group_name}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {selectedThread.is_fallback && (
                              <Button
                                onClick={() => setReclassifyDialogOpen(true)}
                                variant="outline"
                                className="gap-2"
                              >
                                <FolderInput className="h-4 w-4" />
                                Omklassifiser
                              </Button>
                            )}
                            {hasUnacknowledged && (
                              <Button onClick={handleAcknowledge} variant="outline" className="gap-2">
                                <CheckCheck className="h-4 w-4" />
                                Bekreft mottatt
                              </Button>
                            )}
                            <Button onClick={handleResolve} variant="outline" className="gap-2">
                              <Archive className="h-4 w-4" />
                              Løs
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          {messages.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">Ingen meldinger</p>
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
                                    "max-w-[70%] rounded-lg p-4",
                                    msg.direction === "outbound"
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-foreground border"
                                  )}
                                >
                                  {msg.is_fallback && msg.direction === "inbound" && (
                                    <Badge variant="outline" className="mb-2 text-xs">
                                      Ukjent avsender
                                    </Badge>
                                  )}
                                  <p className="text-sm leading-relaxed">{msg.content}</p>
                                  <div className="flex items-center justify-between gap-2 mt-2">
                                    <p
                                      className={cn(
                                        "text-xs",
                                        msg.direction === "outbound"
                                          ? "text-primary-foreground/70"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {new Date(msg.created_at).toLocaleString("no-NO")}
                                    </p>
                                    {msg.direction === "inbound" && msg.is_acknowledged && (
                                      <CheckCheck className="h-3 w-3 text-green-600" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>

                      <CardContent className="border-t p-4">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSendReply();
                          }}
                          className="flex gap-2"
                        >
                          <Textarea
                            placeholder="Skriv svar..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply();
                              }
                            }}
                            className="flex-1 resize-none focus-visible:ring-2 focus-visible:ring-primary"
                            rows={3}
                            disabled={sending}
                          />
                          <Button
                            type="submit"
                            disabled={!replyText.trim() || sending}
                            className="gap-2"
                            size="lg"
                          >
                            <Send className="h-4 w-4" />
                            {sending ? "Sender..." : "Send"}
                          </Button>
                        </form>
                      </CardContent>
                    </>
                  ) : (
                    <CardContent className="flex-1 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Velg en samtale for å se meldinger</p>
                      </div>
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
              Velg riktig gruppe for denne samtalen. Meldingen vil flyttes fra fallback-innboks til
              den valgte gruppen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nåværende gruppe</label>
              <p className="text-sm text-muted-foreground">{selectedThread?.group_name}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ny gruppe</label>
              <Select value={reclassifyTargetGroup} onValueChange={setReclassifyTargetGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg gruppe" />
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
              Omklassifiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}