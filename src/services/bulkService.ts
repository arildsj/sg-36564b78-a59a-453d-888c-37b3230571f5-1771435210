import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type BulkCampaign = Tables<"bulk_campaigns">;
export type BulkRecipient = Tables<"campaign_recipients">;

export interface BulkCampaignData {
  name: string;
  message_template: string;
  campaign_type?: "single" | "bulk" | "scheduled";
  sent_immediately?: boolean;
}

export async function createBulkCampaign(params: {
  name: string;
  message: string;
  contacts: Array<{ id: string; name: string; phone: string }>;
  groupId: string;
  gatewayId: string;
  scheduledAt?: string;
  userId: string;
  tenantId: string;
}): Promise<string> {
  const {
    name,
    message,
    contacts,
    groupId,
    gatewayId,
    scheduledAt,
    userId,
    tenantId,
  } = params;

  // Create campaign
  const { data: campaign, error: campaignError } = await supabase
    .from("bulk_campaigns")
    .insert({
      name,
      message_template: message,
      status: scheduledAt ? "scheduled" : "draft",
      scheduled_at: scheduledAt,
      total_recipients: contacts.length,
      created_by: userId,
      group_id: groupId,
      gateway_id: gatewayId,
      tenant_id: tenantId,
      campaign_type: scheduledAt ? "scheduled" : "bulk",
      sent_immediately: !scheduledAt,
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    throw new Error("Failed to create campaign");
  }

  // Create recipients
  const recipients: TablesInsert<"campaign_recipients">[] = contacts.map((c) => ({
    campaign_id: campaign.id,
    contact_id: c.id,
    phone: c.phone,
    personalized_message: message,
    status: "pending",
  }));

  if (recipients.length > 0) {
    const { error: recipientsError } = await supabase
      .from("campaign_recipients")
      .insert(recipients);

    if (recipientsError) {
      throw new Error("Failed to create recipients");
    }
  }

  return campaign.id;
}

export const bulkService = {
  async createBulkCampaign(data: TablesInsert<"bulk_campaigns">) {
    const { data: campaign, error } = await supabase
      .from("bulk_campaigns")
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return campaign;
  },

  async sendBulkToInternalGroup(
    messageContent: string,
    groupId: string,
    groupName: string,
    subjectLine: string,
    recipientUserIds: string[],
    campaignData?: BulkCampaignData
  ) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, tenant_id")
        .eq("id", user.user.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      const totalRecipients = recipientUserIds.length;
      const campaignType = totalRecipients === 1 ? "single" : "bulk";
      
      // Get a default gateway for the group
      const { data: groupGateway } = await supabase
        .from("groups")
        .select("gateway_id")
        .eq("id", groupId)
        .single();

      const campaign = await this.createBulkCampaign({
        name: campaignData?.name || subjectLine || `Internal ${campaignType === "single" ? "Message" : "Bulk"}`,
        message: messageContent,
        contacts: [],
        groupId: groupId,
        gatewayId: groupGateway?.gateway_id || "",
        userId: profile.id,
        tenantId: profile.tenant_id,
      });

      if (recipientUserIds.length > 0) {
        const { data: users } = await supabase
          .from("user_profiles")
          .select("id, phone, full_name")
          .in("id", recipientUserIds);

        if (users && users.length > 0) {
          const recipients: TablesInsert<"campaign_recipients">[] = users
            .filter(u => u.phone)
            .map(u => ({
              campaign_id: campaign.id,
              phone: u.phone!,
              status: "pending",
              personalized_message: messageContent
            }));

          if (recipients.length > 0) {
            await supabase.from("campaign_recipients").insert(recipients);
          }
        }
      }

      return campaign;
    } catch (error) {
      console.error("Error creating internal bulk campaign:", error);
      throw error;
    }
  },

  async sendBulkToExternalContacts(
    message: string,
    groupId: string,
    groupName: string,
    subjectLine: string
  ) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");
    
    // Get a default gateway for the group
    const { data: groupGateway } = await supabase
      .from("groups")
      .select("gateway_id")
      .eq("id", groupId)
      .single();

    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .insert({
        tenant_id: profile.tenant_id,
        created_by: profile.id,
        name: `Bulk til ${groupName}`,
        message_template: message,
        status: "draft",
        campaign_type: "bulk",
        sent_immediately: true,
        group_id: groupId,
        gateway_id: groupGateway?.gateway_id || ""
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("phone, name")
      .eq("group_id", groupId);

    if (contactsError) throw contactsError;

    const recipients: TablesInsert<"campaign_recipients">[] = (contacts || [])
      .filter((c: any) => c.phone)
      .map((c: any) => ({
        campaign_id: campaign.id,
        phone: c.phone,
        status: "pending"
      }));

    if (recipients.length === 0) {
      throw new Error("Ingen kontakter funnet i denne gruppen");
    }

    const { error: recipientsError } = await supabase
      .from("campaign_recipients")
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

  async sendBulkToExternalContactsWithSelection(
    message: string,
    groupId: string,
    groupName: string,
    subjectLine: string,
    targetPhoneNumbers: string[]
  ) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const campaignType = targetPhoneNumbers.length === 1 ? "single" : "bulk";
    
    // Get a default gateway for the group
    const { data: groupGateway } = await supabase
      .from("groups")
      .select("gateway_id")
      .eq("id", groupId)
      .single();

    const newCampaign: TablesInsert<"bulk_campaigns"> = {
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      name: `${campaignType === "single" ? "Melding" : "Bulk"} til ${groupName}`,
      message_template: message,
      status: "draft",
      campaign_type: campaignType,
      sent_immediately: true,
      group_id: groupId,
      gateway_id: groupGateway?.gateway_id || ""
    };

    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .insert(newCampaign)
      .select()
      .single();

    if (campaignError) throw campaignError;

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("phone, name")
      .eq("group_id", groupId);

    if (contactsError) throw contactsError;

    const recipients: TablesInsert<"campaign_recipients">[] = (contacts || [])
      .filter((c: any) => c.phone && targetPhoneNumbers.includes(c.phone))
      .map((c: any) => ({
        campaign_id: campaign.id,
        phone: c.phone,
        status: "pending"
      }));

    if (recipients.length === 0) {
      throw new Error("Ingen gyldige mottakere funnet i denne gruppen");
    }

    const { error: recipientsError } = await supabase
      .from("campaign_recipients")
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

  async getCampaignDetails(campaignId: string): Promise<{
    campaign: BulkCampaign;
    recipients: BulkRecipient[];
    responders: string[];
    nonResponders: BulkRecipient[];
  }> {
    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError) throw campaignError;

    const { data: recipients, error: recipientsError } = await supabase
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId);

    if (recipientsError) throw recipientsError;

    const { data: responses } = await supabase
      .from("messages")
      .select("from_number")
      .eq("campaign_id", campaignId)
      .eq("direction", "inbound");

    const responderNumbers = new Set(
      (responses || []).map((r) => r.from_number)
    );

    const nonResponders = (recipients || []).filter(
      (r) => !responderNumbers.has(r.phone)
    );

    return {
      campaign: campaign as BulkCampaign,
      recipients: recipients as BulkRecipient[],
      responders: Array.from(responderNumbers),
      nonResponders: nonResponders as BulkRecipient[]
    };
  },

  async getCampaigns() {
    const { data, error } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  async getNonResponders(campaignId: string): Promise<BulkRecipient[]> {
    const { data: recipients, error: recipientsError } = await supabase
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "sent");

    if (recipientsError) throw recipientsError;

    if (!recipients || recipients.length === 0) return [];

    const { data: responses } = await supabase
      .from("messages")
      .select("from_number")
      .eq("campaign_id", campaignId)
      .eq("direction", "inbound");

    const responderNumbers = new Set(
      (responses || []).map((r) => r.from_number)
    );

    return (recipients as BulkRecipient[]).filter(
      (r) => !responderNumbers.has(r.phone)
    );
  },

  async sendReminder(
    originalCampaignId: string,
    reminderMessage: string,
    selectedRecipientIds?: string[]
  ) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { data: originalCampaign } = await supabase
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

    const campaignType = targetRecipients.length === 1 ? "single" : "bulk";

    const reminderCampaignData: TablesInsert<"bulk_campaigns"> = {
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      name: `Påminnelse: ${originalCampaign.name}`,
      message_template: reminderMessage,
      status: "draft",
      campaign_type: campaignType,
      sent_immediately: true,
      group_id: originalCampaign.group_id,
      gateway_id: originalCampaign.gateway_id
    };

    const { data: reminderCampaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .insert(reminderCampaignData)
      .select()
      .single();

    if (campaignError) throw campaignError;

    const recipients: TablesInsert<"campaign_recipients">[] = targetRecipients.map(r => ({
      campaign_id: reminderCampaign.id,
      phone: r.phone,
      status: "pending"
    }));

    const { error: recipientsError } = await supabase
      .from("campaign_recipients")
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
  },

  async triggerCampaign(campaignId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch("/api/bulk-campaign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ campaign_id: campaignId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to trigger campaign");
    }
    return true;
  }
};