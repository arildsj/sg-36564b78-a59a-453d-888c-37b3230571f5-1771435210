import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Send, QrCode, CheckCircle, Clock, AlertCircle, Search, X } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone_number: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
}

interface ValidationErrors {
  pastedText?: string;
  labelType?: string;
  recipients?: string;
  referenceId?: string;
  expectedReply?: string;
}

export default function PrintToSMS() {
  const router = useRouter();
  
  // Form state
  const [pastedText, setPastedText] = useState("");
  const [labelType, setLabelType] = useState<string>("");
  const [referenceId, setReferenceId] = useState("");
  const [expectedReply, setExpectedReply] = useState("");
  const [enableQR, setEnableQR] = useState(false);
  const [qrValidity, setQrValidity] = useState("1h");
  
  // Recipient state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Preview state
  const [previewMode, setPreviewMode] = useState<"sms" | "mms">("sms");
  
  // Send state
  const [isSending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [generatedLabelId, setGeneratedLabelId] = useState<string | null>(null);
  const [sentTimestamp, setSentTimestamp] = useState<string | null>(null);
  
  // Validation state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Load contacts and groups
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch contacts separately to avoid deep type instantiation in Promise.all
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("id, name, phone_number")
        .eq("created_by", user.id)
        .order("name");

      if (contactsError) {
        console.error("Error fetching contacts:", contactsError);
      } else if (contactsData) {
        setContacts(contactsData);
      }

      // Fetch groups separately
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("id, name, description")
        .eq("created_by", user.id)
        .order("name");
        
      if (groupsError) {
        console.error("Error fetching groups:", groupsError);
      } else if (groupsData) {
        setGroups(groupsData);
      }
    }

    loadData();
  }, [router]);

  // Validation functions
  const validatePastedText = (value: string): string | undefined => {
    if (!value.trim()) {
      return "Please paste some content to create a label";
    }
    if (value.length > 2000) {
      return "Content is too long (max 2000 characters)";
    }
    return undefined;
  };

  const validateLabelType = (value: string): string | undefined => {
    if (!value) {
      return "Please select a label type";
    }
    return undefined;
  };

  const validateRecipients = (): string | undefined => {
    if (selectedContacts.length === 0 && selectedGroups.length === 0) {
      return "Please select at least one recipient (contact or group)";
    }
    return undefined;
  };

  const validateReferenceId = (value: string): string | undefined => {
    if (value && value.length > 50) {
      return "Reference ID is too long (max 50 characters)";
    }
    return undefined;
  };

  const validateExpectedReply = (value: string): string | undefined => {
    if (value && value.length > 100) {
      return "Expected reply is too long (max 100 characters)";
    }
    return undefined;
  };

  // Run validation
  const runValidation = (): ValidationErrors => {
    return {
      pastedText: validatePastedText(pastedText),
      labelType: validateLabelType(labelType),
      recipients: validateRecipients(),
      referenceId: validateReferenceId(referenceId),
      expectedReply: validateExpectedReply(expectedReply),
    };
  };

  // Check if form is valid
  const isFormValid = (): boolean => {
    const validationErrors = runValidation();
    return Object.values(validationErrors).every(error => error === undefined);
  };

  // Handle field blur
  const handleBlur = (fieldName: string) => {
    setTouched(prev => new Set(prev).add(fieldName));
    setErrors(runValidation());
  };

  // Handle field change with validation
  const handleFieldChange = (fieldName: string, value: string) => {
    if (touched.has(fieldName)) {
      setErrors(runValidation());
    }
  };

  // Filter contacts and groups by search
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone_number.includes(searchQuery)
  );

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle contact selection
  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
    if (touched.has("recipients")) {
      setErrors(runValidation());
    }
  };

  // Toggle group selection
  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
    if (touched.has("recipients")) {
      setErrors(runValidation());
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
  };

  // Generate label lines
  const generateLabelLines = (): string[] => {
    if (!pastedText.trim()) return [];
    
    const lines = pastedText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    return lines.slice(0, 8).map(line => 
      line.length > 60 ? line.substring(0, 60) + "..." : line
    );
  };

  // Generate QR token
  const generateQRToken = (): string => {
    return `QR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  };

  // Format validity text
  const getValidityText = (): string => {
    const validityMap: { [key: string]: string } = {
      "10m": "10 minutes",
      "1h": "1 hour",
      "1d": "1 day",
      "single": "Single use"
    };
    return validityMap[qrValidity] || "1 hour";
  };

  // Handle send
  const handleSend = async () => {
    // Mark all fields as touched
    setTouched(new Set(["pastedText", "labelType", "recipients", "referenceId", "expectedReply"]));
    
    // Validate
    const validationErrors = runValidation();
    setErrors(validationErrors);
    
    if (!isFormValid()) {
      return;
    }

    setSending(true);

    try {
      // Generate label ID and timestamp
      const labelId = `LABEL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const timestamp = new Date().toISOString();

      // Simulate sending delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Set success state
      setGeneratedLabelId(labelId);
      setSentTimestamp(timestamp);
      setSendSuccess(true);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSendSuccess(false);
      }, 5000);

    } catch (error) {
      console.error("Error sending label:", error);
    } finally {
      setSending(false);
    }
  };

  // Render SMS preview
  const renderSMSPreview = () => {
    const lines = generateLabelLines();
    
    return (
      <div className="space-y-3 font-mono text-sm">
        <div className="font-bold text-base">
          [{labelType || "TYPE"}] {referenceId && `Ref: ${referenceId}`}
        </div>
        
        <Separator />
        
        <div className="space-y-1">
          {lines.length > 0 ? (
            lines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))
          ) : (
            <div className="text-muted-foreground italic">
              Paste content to see preview...
            </div>
          )}
        </div>

        {expectedReply && (
          <>
            <Separator />
            <div className="text-muted-foreground">
              Reply: {expectedReply}
            </div>
          </>
        )}

        {enableQR && (
          <>
            <Separator />
            <div className="text-muted-foreground">
              QR: {generateQRToken()}
              <br />
              Valid for: {getValidityText()}
            </div>
          </>
        )}
      </div>
    );
  };

  // Render MMS preview
  const renderMMSPreview = () => {
    const lines = generateLabelLines();
    
    return (
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg">
                {labelType || "Label Type"}
              </CardTitle>
              {referenceId && (
                <CardDescription className="font-mono text-xs">
                  Ref: {referenceId}
                </CardDescription>
              )}
            </div>
            <Badge variant="secondary" className="ml-2">
              {labelType || "TYPE"}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {lines.length > 0 ? (
              lines.map((line, idx) => (
                <div key={idx} className="text-sm">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-sm italic">
                Paste content to see preview...
              </div>
            )}
          </div>

          {expectedReply && (
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground mb-1">Expected Reply:</div>
              <Badge variant="outline">{expectedReply}</Badge>
            </div>
          )}

          {enableQR && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">QR Code:</div>
                  <div className="font-mono text-xs">{generateQRToken()}</div>
                  <div className="text-xs text-muted-foreground">
                    Valid: {getValidityText()}
                  </div>
                </div>
                <div className="w-24 h-24 bg-muted rounded flex items-center justify-center">
                  <QrCode className="h-16 w-16 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <SEO 
        title="Print to SMS - SeMSe"
        description="Convert copied content into structured SMS/MMS labels"
      />

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Print to SMS</h1>
          <p className="text-muted-foreground mt-1">
            Convert copied content into structured SMS/MMS labels
          </p>
        </div>

        {/* Info Card */}
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>How it works:</strong> Paste content from any system → Convert to structured label → Send as SMS/MMS. 
            No app required for recipients. QR codes enable time-limited actions.
          </AlertDescription>
        </Alert>

        {/* Success Alert */}
        {sendSuccess && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              <strong>Label sent successfully!</strong>
              <div className="mt-2 space-y-1 text-sm">
                <div>Label ID: <span className="font-mono">{generatedLabelId}</span></div>
                <div>Timestamp: {sentTimestamp && new Date(sentTimestamp).toLocaleString()}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="h-3 w-3" />
                  <span>Status: Queued for delivery</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: Input & Options */}
          <div className="space-y-6">
            
            {/* Input Section */}
            <Card>
              <CardHeader>
                <CardTitle>1. Input Content</CardTitle>
                <CardDescription>
                  Paste information copied from another system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pasted-text">
                    Pasted Content <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="pasted-text"
                    placeholder="Paste information here (copied from another system)&#10;&#10;Example:&#10;Order #12345&#10;Customer: John Doe&#10;Delivery: Tomorrow 10:00&#10;Address: Main St 123"
                    value={pastedText}
                    onChange={(e) => {
                      setPastedText(e.target.value);
                      handleFieldChange("pastedText", e.target.value);
                    }}
                    onBlur={() => handleBlur("pastedText")}
                    className={`min-h-[200px] font-mono text-sm ${
                      touched.has("pastedText") && errors.pastedText ? "border-red-500" : ""
                    }`}
                  />
                  {touched.has("pastedText") && errors.pastedText && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.pastedText}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {pastedText.length}/2000 characters
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Label Options */}
            <Card>
              <CardHeader>
                <CardTitle>2. Label Options</CardTitle>
                <CardDescription>
                  Configure label structure and metadata
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="label-type">
                    Label Type <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={labelType} 
                    onValueChange={(value) => {
                      setLabelType(value);
                      handleFieldChange("labelType", value);
                      if (!touched.has("labelType")) {
                        setTouched(prev => new Set(prev).add("labelType"));
                      }
                    }}
                  >
                    <SelectTrigger 
                      id="label-type"
                      className={touched.has("labelType") && errors.labelType ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select label type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alert">Alert</SelectItem>
                      <SelectItem value="Task">Task</SelectItem>
                      <SelectItem value="Access">Access</SelectItem>
                      <SelectItem value="Delivery">Delivery</SelectItem>
                      <SelectItem value="Confirmation">Confirmation</SelectItem>
                      <SelectItem value="Reminder">Reminder</SelectItem>
                    </SelectContent>
                  </Select>
                  {touched.has("labelType") && errors.labelType && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.labelType}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference-id">Reference ID</Label>
                  <Input
                    id="reference-id"
                    placeholder="e.g., Order #12345, Case #ABC-001"
                    value={referenceId}
                    onChange={(e) => {
                      setReferenceId(e.target.value);
                      handleFieldChange("referenceId", e.target.value);
                    }}
                    onBlur={() => handleBlur("referenceId")}
                    className={touched.has("referenceId") && errors.referenceId ? "border-red-500" : ""}
                  />
                  {touched.has("referenceId") && errors.referenceId && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.referenceId}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected-reply">Expected Reply</Label>
                  <Input
                    id="expected-reply"
                    placeholder="e.g., OK, YES, CALL, CONFIRM"
                    value={expectedReply}
                    onChange={(e) => {
                      setExpectedReply(e.target.value);
                      handleFieldChange("expectedReply", e.target.value);
                    }}
                    onBlur={() => handleBlur("expectedReply")}
                    className={touched.has("expectedReply") && errors.expectedReply ? "border-red-500" : ""}
                  />
                  {touched.has("expectedReply") && errors.expectedReply && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.expectedReply}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-qr">Generate QR Code</Label>
                      <p className="text-xs text-muted-foreground">
                        Add time-limited QR code to label
                      </p>
                    </div>
                    <Switch
                      id="enable-qr"
                      checked={enableQR}
                      onCheckedChange={setEnableQR}
                    />
                  </div>

                  {enableQR && (
                    <div className="space-y-2 pl-4 border-l-2">
                      <Label htmlFor="qr-validity">QR Code Validity</Label>
                      <Select value={qrValidity} onValueChange={setQrValidity}>
                        <SelectTrigger id="qr-validity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10m">10 minutes</SelectItem>
                          <SelectItem value="1h">1 hour</SelectItem>
                          <SelectItem value="1d">1 day</SelectItem>
                          <SelectItem value="single">Single use</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        QR codes are time-limited and server-controlled
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recipient Selection */}
            <Card>
              <CardHeader>
                <CardTitle>3. Select Recipients</CardTitle>
                <CardDescription>
                  Choose contacts and groups to receive this label
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts and groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                    onFocus={() => handleBlur("recipients")}
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                      onClick={clearSearch}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Validation Error */}
                {touched.has("recipients") && errors.recipients && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.recipients}</AlertDescription>
                  </Alert>
                )}

                {/* Selection Summary */}
                {(selectedContacts.length > 0 || selectedGroups.length > 0) && (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                    <Badge variant="secondary">
                      {selectedContacts.length} contact{selectedContacts.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="secondary">
                      {selectedGroups.length} group{selectedGroups.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                )}

                <Tabs defaultValue="contacts" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="contacts">
                      Contacts ({filteredContacts.length})
                    </TabsTrigger>
                    <TabsTrigger value="groups">
                      Groups ({filteredGroups.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="contacts" className="space-y-2 mt-4">
                    <ScrollArea className="h-[250px] pr-4">
                      {filteredContacts.length > 0 ? (
                        <div className="space-y-2">
                          {filteredContacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                              onClick={() => toggleContact(contact.id)}
                            >
                              <Checkbox
                                checked={selectedContacts.includes(contact.id)}
                                onCheckedChange={() => toggleContact(contact.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {contact.name}
                                </div>
                                <div className="text-sm text-muted-foreground font-mono">
                                  {contact.phone_number}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          {searchQuery ? "No contacts found" : "No contacts available"}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="groups" className="space-y-2 mt-4">
                    <ScrollArea className="h-[250px] pr-4">
                      {filteredGroups.length > 0 ? (
                        <div className="space-y-2">
                          {filteredGroups.map((group) => (
                            <div
                              key={group.id}
                              className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                              onClick={() => toggleGroup(group.id)}
                            >
                              <Checkbox
                                checked={selectedGroups.includes(group.id)}
                                onCheckedChange={() => toggleGroup(group.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {group.name}
                                </div>
                                {group.description && (
                                  <div className="text-sm text-muted-foreground truncate">
                                    {group.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          {searchQuery ? "No groups found" : "No groups available"}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Preview & Send */}
          <div className="space-y-6">
            
            {/* Preview Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>4. Preview</CardTitle>
                    <CardDescription>
                      See how the label will appear
                    </CardDescription>
                  </div>
                  <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as "sms" | "mms")}>
                    <TabsList>
                      <TabsTrigger value="sms">SMS</TabsTrigger>
                      <TabsTrigger value="mms">MMS</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-muted/30 min-h-[300px]">
                  {previewMode === "sms" ? renderSMSPreview() : renderMMSPreview()}
                </div>
              </CardContent>
            </Card>

            {/* Send Section */}
            <Card>
              <CardHeader>
                <CardTitle>5. Send Label</CardTitle>
                <CardDescription>
                  Deliver label to selected recipients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleSend}
                  disabled={isSending || !isFormValid()}
                  className="w-full"
                  size="lg"
                >
                  {isSending ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send as {previewMode.toUpperCase()}
                    </>
                  )}
                </Button>

                {!isFormValid() && touched.size > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please fix all validation errors before sending
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Labels are delivered immediately</div>
                  <div>• Recipients receive structured content via SMS/MMS</div>
                  <div>• QR codes enable time-limited actions</div>
                  <div>• No app required for recipients</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}