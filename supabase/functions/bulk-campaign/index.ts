// SeMSe + FairGateway: Bulk Campaign Execution
// Process bulk SMS campaigns with per-recipient tracking and proper thread management

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

    // CRITICAL FIX: Use campaign's target_group_id, NOT user's operational group
    const resolvedGroupId = campaign.target_group_id;

    if (!resolvedGroupId) {
      await supabase
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({ error: "No target group specified for campaign" }),
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

        // CRITICAL FIX: Create thread for this bulk recipient
        const threadKey = `${gateway.phone_number}:${recipient.phone_number}`;
        
        const { data: existingThread } = await supabase
          .from("message_threads")
          .select("id")
          .eq("tenant_id", campaign.tenant_id)
          .eq("contact_phone", recipient.phone_number)
          .eq("gateway_id", gateway.id)
          .maybeSingle();

        let threadId;
        if (existingThread) {
          threadId = existingThread.id;
          // Update thread
          await supabase
            .from("message_threads")
            .update({ 
              resolved_group_id: resolvedGroupId,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", threadId);
        } else {
          // Create new thread
          const { data: newThread, error: threadError } = await supabase
            .from("message_threads")
            .insert({
              tenant_id: campaign.tenant_id,
              gateway_id: gateway.id,
              contact_phone: recipient.phone_number,
              resolved_group_id: resolvedGroupId,
              last_message_at: new Date().toISOString(),
              is_resolved: false,
            })
            .select()
            .single();

          if (threadError) throw new Error(threadError.message);
          threadId = newThread.id;
        }

        // Create outbound message with proper routing
        const { data: message, error: messageError } = await supabase
          .from("messages")
          .insert({
            tenant_id: campaign.tenant_id,
            thread_id: threadId,
            gateway_id: gateway.id,
            group_id: resolvedGroupId,
            direction: "outbound",
            from_number: gateway.phone_number,
            to_number: recipient.phone_number,
            content: personalizedContent,
            status: "pending",
            thread_key: threadKey,
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
            sent_thread_id: threadId,
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