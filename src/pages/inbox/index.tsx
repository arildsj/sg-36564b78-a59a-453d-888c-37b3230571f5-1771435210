import React from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Phone, Clock, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data for demonstration
const MOCK_THREADS = [
  {
    id: "1",
    contact_name: "John Doe",
    contact_phone: "+47 123 45 678",
    last_message: "Hei, jeg lurer på om dere har åpent i morgen?",
    last_message_at: "2026-01-30T15:30:00Z",
    unread_count: 2,
    group_name: "Kundeservice",
    is_acknowledged: false,
  },
  {
    id: "2",
    contact_name: "Jane Smith",
    contact_phone: "+47 987 65 432",
    last_message: "Takk for hjelpen!",
    last_message_at: "2026-01-30T14:15:00Z",
    unread_count: 0,
    group_name: "Support",
    is_acknowledged: true,
  },
  {
    id: "3",
    contact_name: "Ukjent avsender",
    contact_phone: "+47 555 12 345",
    last_message: "Hva er åpningstidene deres?",
    last_message_at: "2026-01-30T13:45:00Z",
    unread_count: 1,
    group_name: "Fallback Innboks",
    is_acknowledged: false,
  },
];

const MOCK_MESSAGES = [
  {
    id: "m1",
    direction: "inbound",
    content: "Hei, jeg lurer på om dere har åpent i morgen?",
    created_at: "2026-01-30T15:30:00Z",
    from_number: "+47 123 45 678",
  },
  {
    id: "m2",
    direction: "outbound",
    content: "Hei! Ja, vi har åpent fra 09:00 til 16:00 i morgen.",
    created_at: "2026-01-30T15:32:00Z",
    from_number: "+47 900 00 000",
  },
  {
    id: "m3",
    direction: "inbound",
    content: "Flott, takk for svar!",
    created_at: "2026-01-30T15:33:00Z",
    from_number: "+47 123 45 678",
  },
];

export default function InboxPage() {
  const [selectedThread, setSelectedThread] = React.useState<string | null>(MOCK_THREADS[0]?.id || null);
  const [replyText, setReplyText] = React.useState("");

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    console.log("Sending reply:", replyText);
    setReplyText("");
  };

  const handleAcknowledge = (threadId: string) => {
    console.log("Acknowledging thread:", threadId);
  };

  const currentThread = MOCK_THREADS.find((t) => t.id === selectedThread);

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
                  {MOCK_THREADS.map((thread) => (
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
                            <p className="font-semibold truncate">{thread.contact_name}</p>
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
                  ))}
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
                        <CardTitle>{currentThread.contact_name}</CardTitle>
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
                      {MOCK_MESSAGES.map((msg) => (
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
                      ))}
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
                      />
                      <Button
                        type="submit"
                        disabled={!replyText.trim()}
                        className="gap-2"
                        size="lg"
                      >
                        <Send className="h-4 w-4" />
                        Send
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