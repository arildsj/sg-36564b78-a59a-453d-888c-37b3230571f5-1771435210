// SeMSe + FairGateway: Bulk Campaign Execution
// PROMPT 2: Process bulk SMS campaigns with per-recipient tracking

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkCampaignRequest {
  campaign_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { campaign_id } = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "Missing campaign_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch campaign with recipients
    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .select(`
        *,
        bulk_recipients (*)
      `)
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.status !== "draft") {
      return new Response(
        JSON.stringify({ error: "Campaign already processed", status: campaign.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign status to processing
    await supabase
      .from("bulk_campaigns")
      .update({ 
        status: "sending",
        sent_at: new Date().toISOString(),
        total_recipients: campaign.bulk_recipients?.length || 0
      })
      .eq("id", campaign_id);

    // Get active gateways for load distribution
    const { data: gateways } = await supabase
      .from("gateways")
      .select("id, phone_number")
      .eq("tenant_id", campaign.tenant_id)
      .eq("status", "active");

    if (!gateways || gateways.length === 0) {
      await supabase
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({ error: "No active gateways available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's operational group for message routing
    const { data: userGroups } = await supabase
      .from("group_memberships")
      .select(`
        group:groups!inner(id, kind)
      `)
      .eq("user_id", campaign.created_by_user_id);

    const operationalGroup = userGroups?.find((mg: any) => mg.group?.kind === "operational")?.group;

    if (!operationalGroup) {
      await supabase
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({ error: "No operational group found for user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipients = campaign.bulk_recipients || [];
    let successCount = 0;
    let failedCount = 0;

    // Process recipients in batches
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const gateway = gateways[i % gateways.length]; // Round-robin distribution

      try {
        // Personalize message content
        const personalizedContent = personalizeContent(
          campaign.message_template,
          recipient.metadata
        );

        // Create outbound message with proper routing
        const { data: message, error: messageError } = await supabase
          .from("messages")
          .insert({
            tenant_id: campaign.tenant_id,
            gateway_id: gateway.id,
            direction: "outbound",
            from_number: gateway.phone_number,
            to_number: recipient.phone_number,
            content: personalizedContent,
            resolved_group_id: operationalGroup.id,
            status: "pending",
            thread_key: `${gateway.phone_number}:${recipient.phone_number}`,
          })
          .select()
          .single();

        if (messageError) {
          throw new Error(messageError.message);
        }

        // Update recipient status
        await supabase
          .from("bulk_recipients")
          .update({
            status: "sent",
            sent_message_id: message.id,
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        // Trigger outbound message processing
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/outbound-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ message_id: message.id }),
        });

        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${recipient.phone_number}:`, error);

        await supabase
          .from("bulk_recipients")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", recipient.id);

        failedCount++;
      }

      // Rate limiting (optional)
      if (i < recipients.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
      }
    }

    // Update campaign final status
    const finalStatus = failedCount === 0 ? "completed" : failedCount === recipients.length ? "failed" : "completed";
    await supabase
      .from("bulk_campaigns")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        sent_count: successCount,
        failed_count: failedCount,
      })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        status: "success",
        campaign_id: campaign_id,
        total: recipients.length,
        success: successCount,
        failed: failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bulk campaign error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function personalizeContent(template: string, metadata: any): string {
  if (!metadata) return template;

  let personalized = template;

  // Replace {{variable}} placeholders
  Object.keys(metadata).forEach((key) => {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    personalized = personalized.replace(placeholder, metadata[key] || "");
  });

  return personalized;
}