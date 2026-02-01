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
};

export const bulkService = {
  /**
   * Create and execute a bulk SMS campaign
   */
  async sendBulkMessage(
    message: string,
    groupId: string,
    groupName: string
  ) {
    // 1. Get current user
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // 2. Create Campaign Draft
    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .insert({
        tenant_id: profile.tenant_id,
        created_by_user_id: profile.id, // ID from profiles table, NOT auth.uid()
        name: `Bulk til ${groupName}`,
        message_template: message,
        status: "draft"
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
   * Get campaign logs
   */
  async getCampaigns() {
    const { data, error } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }
};