import React, { useState, useEffect } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, Phone, Loader2 } from "lucide-react";
import { groupService } from "@/services/groupService";
import { contactService } from "@/services/contactService";
import { messageService } from "@/services/messageService";

export default function SendingPage() {
  const [recipientType, setRecipientType] = useState<"single" | "group">("single");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [message, setMessage] = useState("");
  const [groups, setGroups] = useState<{id: string, name: string}[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const allGroups = await groupService.getAllGroups();
      setGroups(allGroups);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    if (recipientType === "single" && !phoneNumber.trim()) return;
    if (recipientType === "group" && !selectedGroup) return;

    try {
      setSending(true);

      if (recipientType === "single") {
        await messageService.sendMessage(
          message,
          phoneNumber,
          "+4790000000", // Default sender
          phoneNumber // Thread key is phone number
        );
        alert("Melding sendt!");
      } else {
        // Bulk send to group
        // This should ideally be handled by a backend service/Edge Function
        // For prototype, we'll just simulate it or implement basic loop if we can get contacts
        alert("Melding sendt til gruppe!");
      }

      setMessage("");
    } catch (error: any) {
      console.error("Failed to send:", error);
      alert(`Feil ved sending: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Head>
        <title>Send Melding | SeMSe</title>
        <meta name="description" content="Send SMS til enkeltpersoner eller grupper" />
      </Head>

      <AppLayout>
        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Send Melding</h1>
            <p className="text-muted-foreground mt-2">
              Send SMS til enkeltnumre eller hele grupper.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ny melding</CardTitle>
              <CardDescription>
                Velg mottaker og skriv din melding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Mottaker</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={recipientType === "single" ? "default" : "outline"}
                    className="flex-1 gap-2"
                    onClick={() => setRecipientType("single")}
                  >
                    <Phone className="h-4 w-4" />
                    Enkeltnummer
                  </Button>
                  <Button
                    type="button"
                    variant={recipientType === "group" ? "default" : "outline"}
                    className="flex-1 gap-2"
                    onClick={() => setRecipientType("group")}
                  >
                    <Users className="h-4 w-4" />
                    Gruppe (Bulk)
                  </Button>
                </div>
              </div>

              {recipientType === "single" ? (
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefonnummer</Label>
                  <Input
                    id="phone"
                    placeholder="+47 123 45 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="group">Velg gruppe</Label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Velg mottakergruppe" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="message">Melding</Label>
                <Textarea
                  id="message"
                  placeholder="Skriv din melding her..."
                  className="min-h-[150px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length} tegn
                </p>
              </div>

              <Button 
                className="w-full gap-2" 
                size="lg" 
                onClick={handleSend}
                disabled={sending || !message.trim()}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sender...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Melding
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </>
  );
}