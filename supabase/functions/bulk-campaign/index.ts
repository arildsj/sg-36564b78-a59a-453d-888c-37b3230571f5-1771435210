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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { campaign_id } = await req.json();

    if (!campaign_id) {
      console.error("Missing campaign_id in request");
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== BULK CAMPAIGN START ===");
    console.log("Campaign ID:", campaign_id);

    // Check auth first
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("User authenticated:", user.id);

    // Fetch campaign with explicit error handling
    console.log("Fetching campaign...");
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("bulk_campaigns")
      .select(`
        *,
        campaign_recipients(*),
        groups!bulk_campaigns_group_id_fkey(
          id,
          name,
          gateway_id,
          sms_gateways(id, gw_phone, name, api_key, base_url)
        )
      `)
      .eq("id", campaign_id)
      .single();

    if (campaignError) {
      console.error("=== CAMPAIGN FETCH ERROR ===");
      console.error("Error code:", campaignError.code);
      console.error("Error message:", campaignError.message);
      console.error("Error details:", campaignError.details);
      console.error("Error hint:", campaignError.hint);
      return new Response(
        JSON.stringify({ 
          error: "Campaign fetch failed",
          code: campaignError.code,
          message: campaignError.message,
          details: campaignError.details,
          hint: campaignError.hint
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!campaign) {
      console.error("Campaign not found (empty result)");
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Campaign fetched:", campaign.id, campaign.name);
    console.log("Recipients count:", campaign.campaign_recipients?.length || 0);
    console.log("Group:", campaign.groups?.name);

    // Check gateway
    const gateway = campaign.groups?.sms_gateways;
    if (!gateway) {
      console.error("No gateway found on group:", campaign.groups?.name);
      return new Response(
        JSON.stringify({ 
          error: "No gateway configured for group",
          group_name: campaign.groups?.name,
          group_id: campaign.group_id
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Gateway found: ${gateway.gw_phone} (${gateway.name})`);

    // Update campaign status
    await supabaseClient
      .from("bulk_campaigns")
      .update({
        status: "sending",
        total_recipients: campaign.campaign_recipients?.length || 0
      })
      .eq("id", campaign_id);

    console.log("Starting to send messages...");
    let successCount = 0;
    let failCount = 0;

    for (const recipient of campaign.campaign_recipients || []) {
      try {
        const personalizedContent = personalizeMessage(
          campaign.message_template,
          recipient.metadata || {}
        );

        console.log(`Sending to ${recipient.phone}: ${personalizedContent}`);

        let thread;
        const { data: existingThread } = await supabaseClient
          .from("message_threads")
          .select()
          .eq("contact_phone", recipient.phone)
          .eq("resolved_group_id", campaign.group_id)
          .maybeSingle();

        if (existingThread) {
          thread = existingThread;
        } else {
          const { data: newThread } = await supabaseClient
            .from("message_threads")
            .insert({
              contact_phone: recipient.phone,
              resolved_group_id: campaign.group_id,
              gateway_id: gateway.id,
              tenant_id: campaign.tenant_id,
              last_message_at: new Date().toISOString(),
              is_resolved: false,
            })
            .select()
            .single();
          thread = newThread;
        }

        const { data: sentMessage, error: messageError } = await supabaseClient
          .from("messages")
          .insert({
            thread_id: thread?.id,
            contact_id: recipient.contact_id,
            direction: "outbound",
            content: personalizedContent,
            from_number: gateway.gw_phone,
            to_number: recipient.phone,
            status: "pending",
            gateway_id: gateway.id,
            group_id: campaign.group_id,
            campaign_id: campaign_id,
            tenant_id: campaign.tenant_id,
            thread_key: `${recipient.phone}-${gateway.id}`,
          })
          .select()
          .single();

        if (messageError) {
          console.error(`Message creation error for ${recipient.phone}:`, messageError);
          failCount++;
          
          await supabaseClient
            .from("campaign_recipients")
            .update({ status: "failed" })
            .eq("id", recipient.id);
          
          continue;
        }

        const gatewayResponse = await fetch(gateway.base_url || "https://api.example.com/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${gateway.api_key}`,
          },
          body: JSON.stringify({
            to: recipient.phone,
            from: gateway.gw_phone,
            message: personalizedContent,
            reference: sentMessage.id,
          }),
        });

        if (!gatewayResponse.ok) {
          const errorText = await gatewayResponse.text();
          console.error(`Gateway error for ${recipient.phone}:`, errorText);
          failCount++;
          
          await supabaseClient
            .from("messages")
            .update({ status: "failed" })
            .eq("id", sentMessage.id);

          await supabaseClient
            .from("campaign_recipients")
            .update({ status: "failed" })
            .eq("id", recipient.id);
          
          continue;
        }

        const gatewayResult = await gatewayResponse.json();
        console.log(`Gateway response for ${recipient.phone}:`, gatewayResult);

        await supabaseClient
          .from("messages")
          .update({
            status: "sent",
            external_id: gatewayResult.message_id,
          })
          .eq("id", sentMessage.id);

        await supabaseClient
          .from("campaign_recipients")
          .update({
            message_id: sentMessage.id,
            sent_at: new Date().toISOString(),
            status: "sent",
          })
          .eq("id", recipient.id);

        successCount++;

      } catch (error) {
        console.error(`Error processing recipient ${recipient.phone}:`, error);
        failCount++;
        
        await supabaseClient
          .from("campaign_recipients")
          .update({ status: "failed" })
          .eq("id", recipient.id);
      }
    }

    const finalStatus = failCount === 0 ? "completed" : successCount === 0 ? "failed" : "completed";
    
    await supabaseClient
      .from("bulk_campaigns")
      .update({
        status: finalStatus,
        sent_count: successCount,
        failed_count: failCount
      })
      .eq("id", campaign_id);

    console.log(`Campaign ${campaign_id} completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id,
        sent: successCount,
        failed: failCount,
        total: campaign.campaign_recipients?.length || 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Bulk campaign error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

function personalizeMessage(template: string, metadata: Record<string, any>): string {
  let personalized = template;
  
  Object.keys(metadata).forEach((key) => {
    const placeholder = `{{${key}}}`;
    personalized = personalized.replace(placeholder, metadata[key] || "");
  });

  return personalized;
}