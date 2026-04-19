import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth gate ──────────────────────────────────────────────────────────────
    // Internal cron callers authenticate via x-cron-secret (shared secret stored
    // in both Vercel env and Supabase secrets).  All other callers must have a
    // valid Supabase user session via the Authorization header.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const incomingCronSecret = req.headers.get("x-cron-secret");
    const isCronCaller = cronSecret && incomingCronSecret === cronSecret;

    if (!isCronCaller) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    // Accept both snake_case (campaign_id, from cron) and camelCase (campaignId)
    const campaignId = body.campaign_id ?? body.campaignId;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
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

    const now = new Date().toISOString();

    await supabaseClient
      .from("bulk_campaigns")
      .update({ 
        status: "processing",
        started_at: now,
        updated_at: now
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

    const finalStatus = successCount === recipients.length ? "completed" : "partial";
    const completedAt = new Date().toISOString();

    await supabaseClient
      .from("bulk_campaigns")
      .update({
        status: finalStatus,
        sent_count: successCount,
        failed_count: failureCount,
        completed_at: completedAt,
        updated_at: completedAt,
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