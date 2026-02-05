import { supabase } from "@/integrations/supabase/client";

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

export const bulkService = {
  /**
   * Generate a unique 2-digit bulk code for a tenant
   */
  async generateBulkCode(tenantId: string): Promise<string> {
    // Get all active campaigns (within 14 days) for this tenant
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: existingCodes } = await supabase
      .from("bulk_campaigns")
      .select("bulk_code")
      .eq("tenant_id", tenantId)
      .gte("created_at", fourteenDaysAgo.toISOString())
      .not("bulk_code", "is", null);

    const usedCodes = new Set((existingCodes || []).map((c: any) => c.bulk_code));

    // Generate unique 2-digit code (10-99)
    for (let i = 10; i <= 99; i++) {
      const code = i.toString();
      if (!usedCodes.has(code)) {
        return code;
      }
    }

    // Fallback: if all codes are used (unlikely), use random
    return Math.floor(Math.random() * 90 + 10).toString();
  },

  /**
   * Create and execute a bulk SMS campaign to internal group members
   */
  async sendBulkToInternalGroup(
    message: string,
    groupId: string,
    groupName: string,
    subjectLine: string,
    selectedMemberIds?: string[]
  ) {
    // 1. Get current user
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // 2. Get group members
    const { data: members, error: membersError } = await supabase
      .from("group_memberships")
      .select(`
        user_id,
        users!inner(
          id,
          phone_number,
          full_name,
          email
        )
      `)
      .eq("group_id", groupId);

    if (membersError) throw membersError;

    if (!members || members.length === 0) {
      throw new Error("Ingen medlemmer funnet i denne gruppen");
    }

    // Filter by selected members if provided
    let targetMembers = members;
    if (selectedMemberIds && selectedMemberIds.length > 0) {
      targetMembers = members.filter((m: any) => 
        selectedMemberIds.includes(m.users.id)
      );
    }

    // 3. Generate bulk code
    const bulkCode = await this.generateBulkCode(profile.tenant_id);

    // 4. Calculate expiry (6 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    // 5. Create Campaign Draft
    const { data: campaign, error: campaignError } = await supabase
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
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // 6. Create recipients from group members
    const recipients = targetMembers
      .map((m: any) => ({
        campaign_id: campaign.id,
        phone_number: m.users.phone_number,
        metadata: { 
          name: m.users.full_name,
          email: m.users.email,
          user_id: m.users.id
        },
        status: "pending"
      }))
      .filter((r: any) => r.phone_number); // Only include members with phone numbers

    if (recipients.length === 0) {
      throw new Error("Ingen medlemmer har telefonnummer registrert");
    }

    // 7. Add recipients to campaign
    const { error: recipientsError } = await supabase
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    // 8. Trigger Sending via Edge Function
    const { error: triggerError } = await supabase.functions.invoke("bulk-campaign", {
      body: { campaign_id: campaign.id }
    });

    if (triggerError) throw triggerError;

    return campaign;
  },

  /**
   * Create and execute a bulk SMS campaign to external contacts
   * RULE: Can only send to registered contacts in the group
   */
  async sendBulkToExternalContacts(
    message: string,
    groupId: string,
    groupName: string,
    subjectLine: string
  ) {
    // 1. Get current user
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // 2. Generate bulk code
    const bulkCode = await this.generateBulkCode(profile.tenant_id);

    // 3. Calculate expiry (6 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    // 4. Create Campaign Draft
    const { data: campaign, error: campaignError } = await supabase
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
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // 5. Fetch contacts from group (ONLY registered contacts)
    const { data: contacts, error: contactsError } = await supabase
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

    // 6. Add recipients to campaign
    const { error: recipientsError } = await supabase
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    // 7. Trigger Sending via Edge Function
    const { error: triggerError } = await supabase.functions.invoke("bulk-campaign", {
      body: { campaign_id: campaign.id }
    });

    if (triggerError) throw triggerError;

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
    // 1. Get current user
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // 2. Generate bulk code
    const bulkCode = await this.generateBulkCode(profile.tenant_id);

    // 3. Calculate expiry (6 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    // 4. Create Campaign Draft
    const { data: campaign, error: campaignError } = await supabase
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
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // 5. Fetch contacts from group to verify they belong and get metadata
    const { data: contacts, error: contactsError } = await supabase
      .from("whitelist_group_links")
      .select(`
        whitelisted_number:whitelisted_numbers(
          phone_number,
          description
        )
      `)
      .eq("group_id", groupId);

    if (contactsError) throw contactsError;

    // Filter to only include selected numbers that are actually in the group
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

    // 6. Add recipients to campaign
    const { error: recipientsError } = await supabase
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    // 7. Trigger Sending via Edge Function
    const { error: triggerError } = await supabase.functions.invoke("bulk-campaign", {
      body: { campaign_id: campaign.id }
    });

    if (triggerError) throw triggerError;

    return campaign;
  },

  /**
   * Get campaign details with recipients and response status
   */
  async getCampaignDetails(campaignId: string): Promise<{
    campaign: BulkCampaign;
    recipients: BulkRecipient[];
    responders: string[]; // Phone numbers that have responded
    nonResponders: BulkRecipient[]; // Recipients who haven't responded
  }> {
    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError) throw campaignError;

    const { data: recipients, error: recipientsError } = await supabase
      .from("bulk_recipients")
      .select("*")
      .eq("campaign_id", campaignId);

    if (recipientsError) throw recipientsError;

    // Get all inbound messages linked to this campaign
    const { data: responses } = await supabase
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
      responders: Array.from(responderNumbers),
      nonResponders: nonResponders as BulkRecipient[]
    };
  },

  /**
   * Get all campaigns for current user
   */
  async getCampaigns() {
    const { data, error } = await supabase
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
    // Get all recipients for the campaign
    const { data: recipients, error: recipientsError } = await supabase
      .from("bulk_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "sent");

    if (recipientsError) throw recipientsError;

    if (!recipients || recipients.length === 0) return [];

    // Get all inbound messages linked to this campaign
    const { data: responses } = await supabase
      .from("messages")
      .select("from_number")
      .eq("campaign_id", campaignId)
      .eq("direction", "inbound");

    const responderNumbers = new Set(
      (responses || []).map((r: any) => r.from_number)
    );

    // Filter recipients who haven't responded
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

    const { data: profile } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // Get original campaign details
    const { data: originalCampaign } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .eq("id", originalCampaignId)
      .single();

    if (!originalCampaign) throw new Error("Original campaign not found");

    // Get non-responders
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

    // Generate new bulk code
    const bulkCode = await this.generateBulkCode(profile.tenant_id);

    // Calculate expiry (6 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    // Create reminder campaign
    const { data: reminderCampaign, error: campaignError } = await supabase
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
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // Add recipients
    const recipients = targetRecipients.map(r => ({
      campaign_id: reminderCampaign.id,
      phone_number: r.phone_number,
      metadata: r.metadata,
      status: "pending"
    }));

    const { error: recipientsError } = await supabase
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    // Trigger sending
    const { error: triggerError } = await supabase.functions.invoke("bulk-campaign", {
      body: { campaign_id: reminderCampaign.id }
    });

    if (triggerError) throw triggerError;

    return reminderCampaign;
  }
};