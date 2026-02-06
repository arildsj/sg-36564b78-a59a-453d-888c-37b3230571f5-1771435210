// SeMSe + FairGateway: Bulk Campaign Execution
// Process bulk SMS campaigns with personalization and gateway routing
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
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing bulk campaign:", campaign_id);

    // Get campaign details with recipients and group
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("bulk_campaigns")
      .select(`
        *,
        bulk_recipients(*),
        groups!bulk_campaigns_source_group_id_fkey(
          id,
          name,
          gateway_id,
          gateways(id, phone_number, provider, api_key)
        )
      `)
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign fetch error:", campaignError);
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate gateway configuration
    const gateway = campaign.groups?.gateways;
    if (!gateway) {
      return new Response(
        JSON.stringify({ error: "No gateway configured for group" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Gateway: ${gateway.phone_number} (${gateway.provider})`);

    // Get user info for message attribution
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign status to processing
    await supabaseClient
      .from("bulk_campaigns")
      .update({
        status: "sending",
        sent_at: new Date().toISOString(),
        target_group_id: campaign.source_group_id,
        total_recipients: campaign.bulk_recipients?.length || 0
      })
      .eq("id", campaign_id);

    let successCount = 0;
    let failCount = 0;

    // Process each recipient
    for (const recipient of campaign.bulk_recipients || []) {
      try {
        // Personalize message content
        const personalizedContent = personalizeMessage(
          campaign.message_template,
          recipient.metadata || {}
        );

        console.log(`Sending to ${recipient.phone_number}: ${personalizedContent}`);

        // Create message thread for this recipient
        const { data: thread } = await supabaseClient
          .from("message_threads")
          .insert({
            contact_phone: recipient.phone_number,
            group_id: campaign.source_group_id,
            status: "active",
            last_message_at: new Date().toISOString(),
            bulk_campaign_id: campaign_id,
            metadata: { bulk_recipient_id: recipient.id }
          })
          .select()
          .single();

        // Create outbound message record
        const { data: sentMessage, error: messageError } = await supabaseClient
          .from("messages")
          .insert({
            thread_id: thread?.id,
            direction: "outbound",
            content: personalizedContent,
            from_number: gateway.phone_number,
            to_number: recipient.phone_number,
            status: "pending",
            gateway_id: gateway.id,
            resolved_group_id: campaign.source_group_id,
            sent_by_user_id: user.id,
            metadata: {
              bulk_campaign_id: campaign_id,
              bulk_recipient_id: recipient.id,
              personalized: true
            }
          })
          .select()
          .single();

        if (messageError) {
          console.error(`Message creation error for ${recipient.phone_number}:`, messageError);
          failCount++;
          
          await supabaseClient
            .from("bulk_recipients")
            .update({ status: "failed" })
            .eq("id", recipient.id);
          
          continue;
        }

        // Call FairGateway API to send SMS
        const fairGatewayResponse = await fetch("https://fairgateway.no/api/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${gateway.api_key}`,
          },
          body: JSON.stringify({
            to: recipient.phone_number,
            from: gateway.phone_number,
            message: personalizedContent,
            callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-webhook`,
            reference: sentMessage.id,
          }),
        });

        if (!fairGatewayResponse.ok) {
          const errorText = await fairGatewayResponse.text();
          console.error(`FairGateway error for ${recipient.phone_number}:`, errorText);
          failCount++;
          
          await supabaseClient
            .from("messages")
            .update({ status: "failed" })
            .eq("id", sentMessage.id);

          await supabaseClient
            .from("bulk_recipients")
            .update({ status: "failed" })
            .eq("id", recipient.id);
          
          continue;
        }

        const gatewayResult = await fairGatewayResponse.json();
        console.log(`Gateway response for ${recipient.phone_number}:`, gatewayResult);

        // Update message with gateway message ID
        await supabaseClient
          .from("messages")
          .update({
            status: "sent",
            gateway_message_id: gatewayResult.message_id,
            sent_at: new Date().toISOString()
          })
          .eq("id", sentMessage.id);

        // Update bulk recipient status
        await supabaseClient
          .from("bulk_recipients")
          .update({
            status: "sent",
            sent_message_id: sentMessage.id,
            sent_at: new Date().toISOString()
          })
          .eq("id", recipient.id);

        successCount++;

      } catch (error) {
        console.error(`Error processing recipient ${recipient.phone_number}:`, error);
        failCount++;
        
        await supabaseClient
          .from("bulk_recipients")
          .update({ status: "failed" })
          .eq("id", recipient.id);
      }
    }

    // Update campaign final status
    const finalStatus = failCount === 0 ? "completed" : successCount === 0 ? "failed" : "completed";
    
    await supabaseClient
      .from("bulk_campaigns")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
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
        total: campaign.bulk_recipients?.length || 0
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
  
  // Replace {{key}} placeholders with metadata values
  Object.keys(metadata).forEach((key) => {
    const placeholder = `{{${key}}}`;
    personalized = personalized.replace(placeholder, metadata[key] || "");
  });

  return personalized;
}