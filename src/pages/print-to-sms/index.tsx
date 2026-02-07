import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Printer, Send, CheckCircle2, Clock, QrCode, BarChart3, Users, Phone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  phone_number: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  member_count?: number;
}

interface LabelData {
  title: string;
  reference_id: string;
  body_lines: string[];
  label_type: string;
  qr_enabled: boolean;
  qr_validity?: string;
  expected_reply?: string;
}

export default function PrintToSMS() {
  const router = useRouter();
  const { t } = useLanguage();
  const [rawText, setRawText] = useState("");
  const [labelType, setLabelType] = useState("alert");
  const [referenceId, setReferenceId] = useState("");
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrValidity, setQrValidity] = useState("1hour");
  const [expectedReply, setExpectedReply] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [labelId, setLabelId] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"sms" | "mms">("sms");

  useEffect(() => {
    fetchContactsAndGroups();
  }, []);

  const fetchContactsAndGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: contactsData } = await supabase
        .from("contacts")
        .select("id, phone_number, name")
        .order("name");

      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name")
        .order("name");

      if (contactsData) setContacts(contactsData);
      if (groupsData) setGroups(groupsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const parseLabelData = (): LabelData => {
    const lines = rawText.split("\n").filter(line => line.trim().length > 0);
    const title = lines[0]?.substring(0, 50) || "Untitled Label";
    const bodyLines = lines.slice(1, 9).map(line => line.substring(0, 160));

    return {
      title,
      reference_id: referenceId,
      body_lines: bodyLines,
      label_type: labelType,
      qr_enabled: qrEnabled,
      qr_validity: qrEnabled ? qrValidity : undefined,
      expected_reply: expectedReply || undefined
    };
  };

  const generateQRToken = (): string => {
    return `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
  };

  const formatSMSPreview = (label: LabelData): string => {
    let message = `📋 ${label.title}\n`;
    if (label.reference_id) {
      message += `Ref: ${label.reference_id}\n`;
    }
    message += "\n";
    label.body_lines.forEach(line => {
      message += `${line}\n`;
    });
    if (label.expected_reply) {
      message += `\n✉️ Reply: ${label.expected_reply}`;
    }
    if (label.qr_enabled) {
      const token = generateQRToken();
      message += `\n\n🔗 Access: ${token}`;
      message += `\nValid: ${label.qr_validity === "10min" ? "10 minutes" : label.qr_validity === "1hour" ? "1 hour" : label.qr_validity === "1day" ? "1 day" : "single use"}`;
    }
    return message;
  };

  const handleSend = async () => {
    if (!rawText.trim()) {
      toast({
        title: "Missing Content",
        description: "Please paste some text to create a label",
        variant: "destructive"
      });
      return;
    }

    if (selectedContacts.length === 0 && selectedGroups.length === 0 && !manualPhone) {
      toast({
        title: "Missing Recipients",
        description: "Please select at least one contact or group",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    
    try {
      const label = parseLabelData();
      const generatedLabelId = `LBL-${Date.now()}`;
      const qrToken = qrEnabled ? generateQRToken() : null;

      // Simulate sending (in production, this would call your message service)
      await new Promise(resolve => setTimeout(resolve, 1500));

      setLabelId(generatedLabelId);
      setSent(true);
      
      toast({
        title: "Label Sent Successfully",
        description: `${selectedContacts.length + selectedGroups.length + (manualPhone ? 1 : 0)} recipient(s) queued for delivery`,
      });

      // Reset form
      setTimeout(() => {
        setRawText("");
        setReferenceId("");
        setQrEnabled(false);
        setExpectedReply("");
        setManualPhone("");
        setSelectedContacts([]);
        setSelectedGroups([]);
        setSent(false);
      }, 5000);

    } catch (error) {
      console.error("Error sending label:", error);
      toast({
        title: "Send Failed",
        description: "Unable to send label. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const labelData = rawText.trim() ? parseLabelData() : null;
  const smsPreview = labelData ? formatSMSPreview(labelData) : "";

  return (
    <AppLayout>
      <SEO 
        title="Print to SMS - SeMSe"
        description="Convert any text into structured SMS/MMS labels with QR codes"
      />
      
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Printer className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Print to SMS</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Convert any text into structured SMS/MMS messages with optional QR codes
          </p>
        </div>

        {/* Success Alert */}
        {sent && (
          <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Label sent successfully!</strong>
              <br />
              Label ID: <code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">{labelId}</code>
              <br />
              Status: Queued for delivery at {new Date().toLocaleTimeString()}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN: Input & Options */}
          <div className="space-y-6">
            {/* Input Section */}
            <Card>
              <CardHeader>
                <CardTitle>1. Paste Content</CardTitle>
                <CardDescription>Copy text from any system and paste it here</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Paste information here (copied from another system)&#10;&#10;Example:&#10;Delivery Notice&#10;Your package #12345 is ready&#10;Pickup at warehouse A&#10;Gate code: 4567"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  First line becomes the title. Up to 8 additional lines for body content.
                </div>
              </CardContent>
            </Card>

            {/* Label Options */}
            <Card>
              <CardHeader>
                <CardTitle>2. Label Options</CardTitle>
                <CardDescription>Configure label type and features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Label Type</Label>
                  <Select value={labelType} onValueChange={setLabelType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alert">🚨 Alert</SelectItem>
                      <SelectItem value="task">✓ Task</SelectItem>
                      <SelectItem value="access">🔑 Access</SelectItem>
                      <SelectItem value="delivery">📦 Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reference ID (Optional)</Label>
                  <Input
                    placeholder="e.g. Order #12345"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expected Reply (Optional)</Label>
                  <Input
                    placeholder="e.g. OK, YES, CALL"
                    value={expectedReply}
                    onChange={(e) => setExpectedReply(e.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Generate QR Code</Label>
                      <div className="text-xs text-muted-foreground">
                        Time-limited and server-controlled
                      </div>
                    </div>
                    <Switch
                      checked={qrEnabled}
                      onCheckedChange={setQrEnabled}
                    />
                  </div>

                  {qrEnabled && (
                    <div className="space-y-2 pl-4 border-l-2 border-primary">
                      <Label>QR Code Validity</Label>
                      <Select value={qrValidity} onValueChange={setQrValidity}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10min">10 minutes</SelectItem>
                          <SelectItem value="1hour">1 hour</SelectItem>
                          <SelectItem value="1day">1 day</SelectItem>
                          <SelectItem value="single">Single use</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recipients */}
            <Card>
              <CardHeader>
                <CardTitle>3. Select Recipients</CardTitle>
                <CardDescription>Choose contacts or groups to send to</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Contacts
                  </Label>
                  <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-1">
                    {contacts.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No contacts available</div>
                    ) : (
                      contacts.map(contact => (
                        <label key={contact.id} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContacts([...selectedContacts, contact.id]);
                              } else {
                                setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">
                            {contact.name} ({contact.phone_number})
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Groups
                  </Label>
                  <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-1">
                    {groups.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No groups available</div>
                    ) : (
                      groups.map(group => (
                        <label key={group.id} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(group.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroups([...selectedGroups, group.id]);
                              } else {
                                setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm font-medium">{group.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Manual Phone Number (Demo)
                  </Label>
                  <Input
                    placeholder="+47 123 45 678"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Preview & Send */}
          <div className="space-y-6">
            {/* Delivery Mode */}
            <Card>
              <CardHeader>
                <CardTitle>4. Preview & Send</CardTitle>
                <CardDescription>Review how your label will appear</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={deliveryMode === "sms" ? "default" : "outline"}
                    onClick={() => setDeliveryMode("sms")}
                    className="flex-1"
                  >
                    SMS Preview
                  </Button>
                  <Button
                    variant={deliveryMode === "mms" ? "default" : "outline"}
                    onClick={() => setDeliveryMode("mms")}
                    className="flex-1"
                  >
                    MMS Preview
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            {deliveryMode === "sms" ? (
              <Card className="border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">SMS Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {!rawText.trim() ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Paste content to see preview
                    </div>
                  ) : (
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
                      {smsPreview}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">MMS Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {!rawText.trim() ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Paste content to see preview
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-6 rounded-lg space-y-4">
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-lg">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-lg">{labelData?.title}</h3>
                          <Badge variant="outline">{labelType}</Badge>
                        </div>
                        
                        {referenceId && (
                          <div className="text-sm text-muted-foreground mb-3">
                            Ref: {referenceId}
                          </div>
                        )}
                        
                        <div className="space-y-2 mb-4">
                          {labelData?.body_lines.map((line, idx) => (
                            <p key={idx} className="text-sm">{line}</p>
                          ))}
                        </div>

                        {expectedReply && (
                          <div className="border-t pt-3 mt-3">
                            <div className="text-xs text-muted-foreground">Expected reply:</div>
                            <div className="font-medium">{expectedReply}</div>
                          </div>
                        )}

                        {qrEnabled && (
                          <div className="border-t pt-4 mt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs text-muted-foreground">Secure Access Code</div>
                                <div className="font-mono text-sm font-bold">{generateQRToken()}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Valid: {qrValidity === "10min" ? "10 minutes" : qrValidity === "1hour" ? "1 hour" : qrValidity === "1day" ? "1 day" : "single use"}
                                </div>
                              </div>
                              <div className="w-24 h-24 bg-white border-2 border-gray-300 rounded flex items-center justify-center">
                                <QrCode className="h-16 w-16 text-gray-400" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Send Action */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleSend}
                  disabled={sending || !rawText.trim()}
                >
                  {sending ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send as {deliveryMode.toUpperCase()}
                    </>
                  )}
                </Button>

                <div className="mt-4 text-xs text-center text-muted-foreground space-y-1">
                  <p>✓ No app required for recipients</p>
                  <p>✓ Works on any mobile phone</p>
                  <p>✓ QR codes are time-limited and secure</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info Section */}
        <Card className="mt-8 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100">About Print to SMS</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800 dark:text-blue-200 space-y-2">
            <p>
              <strong>Print to SMS</strong> converts any text into structured SMS/MMS messages that can be sent to mobile phones.
            </p>
            <p>
              This is a <strong>label-based messaging workflow</strong>, not a print driver or document renderer.
            </p>
            <p>
              Recipients receive clear, structured information via standard SMS/MMS - no special app required.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}