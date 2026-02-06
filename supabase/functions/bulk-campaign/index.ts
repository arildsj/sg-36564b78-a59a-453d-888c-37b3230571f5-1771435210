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

        // Create or find thread for this recipient
        let thread;
        const { data: existingThread } = await supabaseClient
          .from("message_threads")
          .select()
          .eq("contact_phone", recipient.phone_number)
          .eq("resolved_group_id", campaign.source_group_id)
          .maybeSingle();

        if (existingThread) {
          thread = existingThread;
        } else {
          const { data: newThread } = await supabaseClient
            .from("message_threads")
            .insert({
              contact_phone: recipient.phone_number,
              resolved_group_id: campaign.source_group_id,
              gateway_id: gateway.id,
              last_message_at: new Date().toISOString(),
              is_resolved: false,
            })
            .select()
            .single();
          thread = newThread;
        }

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
            group_id: campaign.source_group_id,
            campaign_id: campaign_id,
            thread_key: `${recipient.phone_number}-${gateway.id}`,
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

        // Update bulk recipient status WITH sent_thread_id
        await supabaseClient
          .from("bulk_recipients")
          .update({
            sent_message_id: sentMessage.id,
            sent_thread_id: thread?.id,
            sent_at: new Date().toISOString(),
            status: "sent",
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