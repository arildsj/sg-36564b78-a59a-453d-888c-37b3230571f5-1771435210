import { supabase } from "@/integrations/supabase/client";

export type BulkCampaign = {
  id: string;
  name: string;
  message_template: string;
  status: "draft" | "scheduled" | "processing" | "completed" | "failed";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
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
   * Create and execute a bulk SMS campaign to internal group members
   */
  async sendBulkToInternalGroup(
    message: string,
    groupId: string,
    groupName: string,
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

    // 3. Create Campaign Draft
    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .insert({
        tenant_id: profile.tenant_id,
        created_by_user_id: profile.id,
        name: `Bulk til ${groupName}`,
        message_template: message,
        status: "draft",
        source_group_id: groupId
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // 4. Create recipients from group members
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

    // 5. Add recipients to campaign
    const { error: recipientsError } = await supabase
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    // 6. Trigger Sending via Edge Function
    const { error: triggerError } = await supabase.functions.invoke("bulk-campaign", {
      body: { campaign_id: campaign.id }
    });

    if (triggerError) throw triggerError;

    return campaign;
  },

  /**
   * Create and execute a bulk SMS campaign to external contacts
   */
  async sendBulkToExternalContacts(
    message: string,
    groupId: string,
    groupName: string
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

    // 2. Create Campaign Draft
    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .insert({
        tenant_id: profile.tenant_id,
        created_by_user_id: profile.id,
        name: `Bulk til ${groupName}`,
        message_template: message,
        status: "draft",
        source_group_id: groupId
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // 3. Fetch contacts from group
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

    // 4. Add recipients to campaign
    const { error: recipientsError } = await supabase
      .from("bulk_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    // 5. Trigger Sending via Edge Function
    const { error: triggerError } = await supabase.functions.invoke("bulk-campaign", {
      body: { campaign_id: campaign.id }
    });

    if (triggerError) throw triggerError;

    return campaign;
  },

  /**
   * Get campaign details with recipients
   */
  async getCampaignDetails(campaignId: string): Promise<{
    campaign: BulkCampaign;
    recipients: BulkRecipient[];
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

    return {
      campaign: campaign as BulkCampaign,
      recipients: (recipients || []) as BulkRecipient[]
    };
  },

  /**
   * Get all campaigns
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
  }
};