import React, { useEffect, useState } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Phone, Clock, CheckCheck, Inbox as InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { messageService } from "@/services/messageService";
import { supabase } from "@/integrations/supabase/client";

type Thread = {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  group_name: string;
  is_acknowledged: boolean;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  created_at: string;
  from_number: string;
};

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread);
    }
  }, [selectedThread]);

  const loadThreads = async () => {
    try {
      setLoading(true);
      // TODO: Implement getThreads in messageService
      // For now, load all messages grouped by phone number
      const allMessages = await messageService.getUnacknowledgedMessages();
      
      // Group by from_number (simple implementation)
      const threadMap = new Map<string, Thread>();
      
      allMessages.forEach((msg: any) => {
        if (!threadMap.has(msg.from_number)) {
          threadMap.set(msg.from_number, {
            id: msg.from_number,
            contact_name: null,
            contact_phone: msg.from_number,
            last_message: msg.content,
            last_message_at: msg.created_at,
            unread_count: msg.is_acknowledged ? 0 : 1,
            group_name: "Generell",
            is_acknowledged: msg.is_acknowledged,
          });
        }
      });

      setThreads(Array.from(threadMap.values()));
      
      // Auto-select first thread
      if (threadMap.size > 0 && !selectedThread) {
        setSelectedThread(Array.from(threadMap.keys())[0]);
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (phoneNumber: string) => {
    try {
      // Load all messages for this phone number
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`from_number.eq.${phoneNumber},to_number.eq.${phoneNumber}`)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        direction: msg.direction,
        content: msg.content,
        created_at: msg.created_at,
        from_number: msg.from_number,
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;

    try {
      setSending(true);
      
      // TODO: Implement sendMessage in messageService
      const { error } = await supabase.from("messages").insert({
        direction: "outbound",
        content: replyText,
        to_number: selectedThread,
        from_number: "+47 900 00 000", // TODO: Get from gateway config
        status: "pending",
      });

      if (error) throw error;

      setReplyText("");
      await loadMessages(selectedThread);
    } catch (error) {
      console.error("Failed to send reply:", error);
      alert("Kunne ikke sende melding");
    } finally {
      setSending(false);
    }
  };

  const handleAcknowledge = async (threadId: string) => {
    try {
      // Mark all messages from this thread as acknowledged
      const { error } = await supabase
        .from("messages")
        .update({ is_acknowledged: true })
        .eq("from_number", threadId)
        .eq("is_acknowledged", false);

      if (error) throw error;

      await loadThreads();
    } catch (error) {
      console.error("Failed to acknowledge thread:", error);
    }
  };

  const currentThread = threads.find((t) => t.id === selectedThread);

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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
            {/* Thread List */}
            <Card className="lg:col-span-1 flex flex-col">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Samtaler
                </CardTitle>
              </CardHeader>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {loading ? (
                    <p className="text-muted-foreground text-center py-8">Laster...</p>
                  ) : threads.length === 0 ? (
                    <div className="text-center py-12">
                      <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground">Ingen samtaler ennå</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Meldinger vil vises her når de ankommer
                      </p>
                    </div>
                  ) : (
                    threads.map((thread) => (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedThread(thread.id)}
                        className={cn(
                          "w-full text-left p-4 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                          selectedThread === thread.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card hover:bg-accent"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold truncate">
                                {thread.contact_name || thread.contact_phone}
                              </p>
                              {!thread.is_acknowledged && (
                                <Badge variant="destructive" className="text-xs">
                                  Ny
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm opacity-90 flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              {thread.contact_phone}
                            </p>
                            <p className="text-xs opacity-75 mt-1">{thread.group_name}</p>
                            <p className="text-sm mt-2 truncate opacity-80">{thread.last_message}</p>
                            <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(thread.last_message_at).toLocaleString("no-NO")}
                            </p>
                          </div>
                          {thread.unread_count > 0 && (
                            <Badge className="bg-red-600 text-white">{thread.unread_count}</Badge>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>

            {/* Message Thread View */}
            <Card className="lg:col-span-2 flex flex-col">
              {currentThread ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{currentThread.contact_name || currentThread.contact_phone}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {currentThread.contact_phone}
                        </p>
                      </div>
                      {!currentThread.is_acknowledged && (
                        <Button
                          onClick={() => handleAcknowledge(currentThread.id)}
                          variant="outline"
                          className="gap-2"
                        >
                          <CheckCheck className="h-4 w-4" />
                          Bekreft mottatt
                        </Button>
                      )}
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
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              <p
                                className={cn(
                                  "text-xs mt-2",
                                  msg.direction === "outbound"
                                    ? "text-primary-foreground/70"
                                    : "text-muted-foreground"
                                )}
                              >
                                {new Date(msg.created_at).toLocaleString("no-NO")}
                              </p>
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
        </div>
      </AppLayout>
    </>
  );
}