import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Campaign ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing bulk campaign:", campaignId);

    const { data: campaign, error: campaignError } = await supabaseClient
      .from("bulk_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign fetch error:", campaignError);
      return new Response(
        JSON.stringify({ error: "Campaign not found", details: campaignError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Campaign fetched:", campaign.name);

    const { data: recipients, error: recipientsError } = await supabaseClient
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId);

    if (recipientsError) {
      console.error("Recipients fetch error:", recipientsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch recipients", details: recipientsError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${recipients?.length || 0} recipients`);

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients found for this campaign" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabaseClient
      .from("bulk_campaigns")
      .update({ 
        status: "processing",
        started_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    let successCount = 0;
    let failureCount = 0;

    for (const recipient of recipients) {
      try {
        const messageData = {
          direction: "outbound",
          from_number: campaign.gateway_id || "system",
          to_number: recipient.phone,
          content: recipient.personalized_message || campaign.message_template,
          status: "pending",
          gateway_id: campaign.gateway_id,
          contact_id: recipient.contact_id,
          group_id: campaign.group_id,
          tenant_id: campaign.tenant_id,
          campaign_id: campaignId,
        };

        const { data: message, error: messageError } = await supabaseClient
          .from("messages")
          .insert(messageData)
          .select()
          .single();

        if (messageError) {
          throw messageError;
        }

        await supabaseClient
          .from("campaign_recipients")
          .update({
            status: "sent",
            message_id: message.id,
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        successCount++;
      } catch (error) {
        console.error("Failed to send to recipient:", recipient.id, error);
        
        await supabaseClient
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", recipient.id);

        failureCount++;
      }
    }

    await supabaseClient
      .from("bulk_campaigns")
      .update({
        status: successCount === recipients.length ? "completed" : "partial",
        sent_count: successCount,
        failed_count: failureCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaignId,
        total: recipients.length,
        sent: successCount,
        failed: failureCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        details: error,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});