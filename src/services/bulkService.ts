import { supabase } from "@/integrations/supabase/client";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export type BulkCampaign = {
  id: string;
  name: string;
  subject_line?: string;
  bulk_code?: string;
  message_template: string;
  status: "draft" | "scheduled" | "sending" | "completed" | "failed";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  expires_at?: string;
  source_group_id?: string;
};

export type BulkRecipient = {
  id: string;
  campaign_id: string;
  phone_number: string;
  status: "pending" | "sent" | "failed";
  metadata?: any;
  sent_at?: string;
  error_message?: string;
};

export interface BulkCampaignData {
  name: string;
  message_template: string;
  subject_line?: string;
  reply_window_hours?: number;
  recipient_contacts?: string[];
  recipient_groups?: string[];
}

export const bulkService = {
  /**
   * Generate a unique 2-digit bulk code for a tenant
   */
  async generateBulkCode(tenantId: string): Promise<string> {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: existingCodes } = await db
      .from("bulk_campaigns")
      .select("bulk_code")
      .eq("tenant_id", tenantId)
      .gte("created_at", fourteenDaysAgo.toISOString())
      .not("bulk_code", "is", null);

    const usedCodes = new Set((existingCodes || []).map((c: any) => c.bulk_code));

    for (let i = 10; i <= 99; i++) {
      const code = i.toString();
      if (!usedCodes.has(code)) {
        return code;
      }
    }

    return Math.floor(Math.random() * 90 + 10).toString();
  },

  /**
   * Create a new bulk campaign record
   */
  async createBulkCampaign(data: any) {
    const { data: campaign, error } = await db
      .from("bulk_campaigns")
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return campaign;
  },

  /**
   * Create and execute a bulk SMS campaign to internal group members
   */
  async sendBulkToInternalGroup(
    messageContent: string,
    sourceGroupId: string,
    groupName: string,
    subjectLine: string,
    recipientUserIds: string[],
    campaignData?: BulkCampaignData
  ) {
    try {
      console.log("Creating internal bulk campaign...");
      
      // 1. Create campaign record
      const campaign = await this.createBulkCampaign({
        name: campaignData?.name || subjectLine || `Internal Bulk ${new Date().toISOString()}`,
        message_template: messageContent,
        subject_line: subjectLine,
        status: "sending",
        source_group_id: sourceGroupId,
        target_group_id: sourceGroupId, // Sending to same group members
        recipient_contacts: [],
        recipient_groups: [sourceGroupId],
        reply_window_hours: campaignData?.reply_window_hours
      });
    } catch (error) {
      console.error("Error creating internal bulk campaign:", error);
      throw error;
    }
  },

  /**
   * Create and execute a bulk SMS campaign to external contacts
   */
  async sendBulkToExternalContacts(
    message: string,
    groupId: string,
    groupName: string,
    subjectLine: string
  ) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("id, tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const bulkCode = await this.generateBulkCode(profile.tenant_id);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    const { data: campaign, error: campaignError } = await db
      .from("bulk_campaigns")
      .insert({
        tenant_id: profile.tenant_id,
        created_by_user_id: profile.id,
        name: `Bulk til ${groupName}`,
        subject_line: subjectLine,
        bulk_code: bulkCode,
        message_template: message,
        status: "draft",
        source_group_id: groupId,
        target_group_id: groupId,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    const { data: contacts, error: contactsError } = await db
      .from("whitelist_group_links")
      .select(`
        whitelisted_number:whitelisted_numbers(
          phone_number,
          description
        )
      `)
      .eq("group_id", groupId);

    if (contactsError) throw contactsError;

    const recipients = (contacts || [])
      .map((link: any) => link.whitelisted_number)
      .filter(Boolean)
      .map((c: any) => ({
        campaign_id: campaign.id,
        phone_number: c.phone_number,
        metadata: { name: c.description },
        status: "pending"
      }));

    if (recipients.length === 0) {
      throw new Error("Ingen kontakter funnet i denne gruppen");
    }

    const { error: recipientsError } = await db
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const triggerResponse = await fetch("/api/bulk-campaign", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ campaign_id: campaign.id }),
    });

    if (!triggerResponse.ok) {
      const errorData = await triggerResponse.json();
      throw new Error(errorData.error || "Failed to trigger campaign");
    }

    return campaign;
  },

  /**
   * Create and execute a bulk SMS campaign to specific external contacts
   */
  async sendBulkToExternalContactsWithSelection(
    message: string,
    groupId: string,
    groupName: string,
    subjectLine: string,
    targetPhoneNumbers: string[]
  ) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("id, tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const bulkCode = await this.generateBulkCode(profile.tenant_id);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    const { data: campaign, error: campaignError } = await db
      .from("bulk_campaigns")
      .insert({
        tenant_id: profile.tenant_id,
        created_by_user_id: profile.id,
        name: `Bulk til ${groupName}`,
        subject_line: subjectLine,
        bulk_code: bulkCode,
        message_template: message,
        status: "draft",
        source_group_id: groupId,
        target_group_id: groupId,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    const { data: contacts, error: contactsError } = await db
      .from("whitelist_group_links")
      .select(`
        whitelisted_number:whitelisted_numbers(
          phone_number,
          description
        )
      `)
      .eq("group_id", groupId);

    if (contactsError) throw contactsError;

    const recipients = (contacts || [])
      .map((link: any) => link.whitelisted_number)
      .filter(Boolean)
      .filter((c: any) => targetPhoneNumbers.includes(c.phone_number))
      .map((c: any) => ({
        campaign_id: campaign.id,
        phone_number: c.phone_number,
        metadata: { name: c.description },
        status: "pending"
      }));

    if (recipients.length === 0) {
      throw new Error("Ingen gyldige mottakere funnet i denne gruppen");
    }

    const { error: recipientsError } = await db
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const triggerResponse = await fetch("/api/bulk-campaign", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ campaign_id: campaign.id }),
    });

    if (!triggerResponse.ok) {
      const errorData = await triggerResponse.json();
      throw new Error(errorData.error || "Failed to trigger campaign");
    }

    return campaign;
  },

  /**
   * Get campaign details with recipients and response status
   */
  async getCampaignDetails(campaignId: string): Promise<{
    campaign: BulkCampaign;
    recipients: BulkRecipient[];
    responders: string[];
    nonResponders: BulkRecipient[];
  }> {
    const { data: campaign, error: campaignError } = await db
      .from("bulk_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError) throw campaignError;

    const { data: recipients, error: recipientsError } = await db
      .from("bulk_recipients")
      .select("*")
      .eq("campaign_id", campaignId);

    if (recipientsError) throw recipientsError;

    const { data: responses } = await db
      .from("messages")
      .select("from_number")
      .eq("campaign_id", campaignId)
      .eq("direction", "inbound");

    const responderNumbers = new Set(
      (responses || []).map((r: any) => r.from_number)
    );

    const nonResponders = (recipients || []).filter(
      (r: any) => !responderNumbers.has(r.phone_number)
    );

    return {
      campaign: campaign as BulkCampaign,
      recipients: (recipients || []) as BulkRecipient[],
      responders: Array.from(responderNumbers) as string[],
      nonResponders: nonResponders as BulkRecipient[]
    };
  },

  /**
   * Get all campaigns for current user
   */
  async getCampaigns() {
    const { data, error } = await db
      .from("bulk_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get recipients who haven't responded to a campaign
   */
  async getNonResponders(campaignId: string): Promise<BulkRecipient[]> {
    const { data: recipients, error: recipientsError } = await db
      .from("bulk_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "sent");

    if (recipientsError) throw recipientsError;

    if (!recipients || recipients.length === 0) return [];

    const { data: responses } = await db
      .from("messages")
      .select("from_number")
      .eq("campaign_id", campaignId)
      .eq("direction", "inbound");

    const responderNumbers = new Set(
      (responses || []).map((r: any) => r.from_number)
    );

    return recipients.filter(
      (r: any) => !responderNumbers.has(r.phone_number)
    ) as BulkRecipient[];
  },

  /**
   * Send reminder to non-responders
   */
  async sendReminder(
    originalCampaignId: string,
    reminderMessage: string,
    selectedRecipientIds?: string[]
  ) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("id, tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { data: originalCampaign } = await db
      .from("bulk_campaigns")
      .select("*")
      .eq("id", originalCampaignId)
      .single();

    if (!originalCampaign) throw new Error("Original campaign not found");

    const nonResponders = await this.getNonResponders(originalCampaignId);

    let targetRecipients = nonResponders;
    if (selectedRecipientIds && selectedRecipientIds.length > 0) {
      targetRecipients = nonResponders.filter(r => 
        selectedRecipientIds.includes(r.id)
      );
    }

    if (targetRecipients.length === 0) {
      throw new Error("Ingen mottakere valgt for påminnelse");
    }

    const bulkCode = await this.generateBulkCode(profile.tenant_id);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    const { data: reminderCampaign, error: campaignError } = await db
      .from("bulk_campaigns")
      .insert({
        tenant_id: profile.tenant_id,
        created_by_user_id: profile.id,
        name: `Påminnelse: ${originalCampaign.subject_line}`,
        subject_line: originalCampaign.subject_line,
        bulk_code: bulkCode,
        message_template: reminderMessage,
        status: "draft",
        source_group_id: originalCampaign.source_group_id,
        target_group_id: originalCampaign.target_group_id,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    const recipients = targetRecipients.map(r => ({
      campaign_id: reminderCampaign.id,
      phone_number: r.phone_number,
      metadata: r.metadata,
      status: "pending"
    }));

    const { error: recipientsError } = await db
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const triggerResponse = await fetch("/api/bulk-campaign", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ campaign_id: reminderCampaign.id }),
    });

    if (!triggerResponse.ok) {
      const errorData = await triggerResponse.json();
      throw new Error(errorData.error || "Failed to trigger campaign");
    }

    return reminderCampaign;
  }
};