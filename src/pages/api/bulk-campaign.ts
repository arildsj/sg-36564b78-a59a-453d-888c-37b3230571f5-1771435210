import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🚀 Bulk campaign API called");
    console.log("📦 Request body:", JSON.stringify(req.body));

    // Validate environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL");
      return res.status(500).json({ error: "Missing Supabase URL configuration" });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");
      return res.status(500).json({ error: "Missing Service Role Key configuration" });
    }

    // Create admin client inside handler to avoid initialization issues
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log("✅ Supabase admin client created");

    const { campaign_id } = req.body;

    if (!campaign_id) {
      console.error("❌ Missing campaign_id in request");
      return res.status(400).json({ error: "Missing campaign_id parameter" });
    }

    console.log("🔍 Fetching campaign:", campaign_id);

    // Fetch campaign with recipients
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("bulk_campaigns")
      .select(`
        *,
        bulk_recipients (*)
      `)
      .eq("id", campaign_id)
      .single();

    if (campaignError) {
      console.error("❌ Campaign fetch error:", campaignError);
      return res.status(500).json({ 
        error: "Failed to fetch campaign", 
        details: campaignError.message 
      });
    }

    if (!campaign) {
      console.error("❌ Campaign not found:", campaign_id);
      return res.status(404).json({ error: "Campaign not found" });
    }

    console.log("✅ Campaign found:", campaign.name);
    console.log("📊 Recipients count:", campaign.bulk_recipients?.length || 0);

    if (campaign.status !== "draft") {
      console.warn("⚠️ Campaign already processed:", campaign.status);
      return res.status(400).json({ 
        error: "Campaign already processed", 
        status: campaign.status 
      });
    }

    // Update campaign status to processing
    console.log("📝 Updating campaign status to sending...");
    const { error: updateError } = await supabaseAdmin
      .from("bulk_campaigns")
      .update({ 
        status: "sending",
        sent_at: new Date().toISOString(),
        total_recipients: campaign.bulk_recipients?.length || 0
      })
      .eq("id", campaign_id);

    if (updateError) {
      console.error("❌ Failed to update campaign status:", updateError);
      return res.status(500).json({ 
        error: "Failed to update campaign", 
        details: updateError.message 
      });
    }

    console.log("✅ Campaign status updated to sending");

    // Get active gateways for load distribution
    console.log("🔍 Fetching active gateways...");
    const { data: gateways, error: gatewaysError } = await supabaseAdmin
      .from("gateways")
      .select("id, phone_number")
      .eq("tenant_id", campaign.tenant_id)
      .eq("status", "active");

    if (gatewaysError) {
      console.error("❌ Gateways fetch error:", gatewaysError);
      await supabaseAdmin
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);
      return res.status(500).json({ 
        error: "Failed to fetch gateways", 
        details: gatewaysError.message 
      });
    }

    if (!gateways || gateways.length === 0) {
      console.error("❌ No active gateways available");
      await supabaseAdmin
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);
      return res.status(400).json({ error: "No active gateways available" });
    }

    console.log("✅ Found active gateways:", gateways.length);

    // Get target group for message routing
    console.log("🔍 Fetching target group...");
    const { data: targetGroup, error: groupError } = await supabaseAdmin
      .from("groups")
      .select("id, kind")
      .eq("id", campaign.target_group_id)
      .single();

    if (groupError) {
      console.error("❌ Target group fetch error:", groupError);
      await supabaseAdmin
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);
      return res.status(500).json({ 
        error: "Failed to fetch target group", 
        details: groupError.message 
      });
    }

    if (!targetGroup) {
      console.error("❌ Target group not found:", campaign.target_group_id);
      await supabaseAdmin
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);
      return res.status(400).json({ error: "Target group not found" });
    }

    console.log("✅ Target group found:", targetGroup.id);

    const recipients = campaign.bulk_recipients || [];
    let successCount = 0;
    let failedCount = 0;

    console.log(`🚀 Starting to process ${recipients.length} recipients...`);

    // Process recipients in batches
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const gateway = gateways[i % gateways.length]; // Round-robin distribution

      try {
        console.log(`📤 Processing recipient ${i + 1}/${recipients.length}: ${recipient.phone_number}`);

        // Personalize message content
        const personalizedContent = personalizeContent(
          campaign.message_template,
          recipient.metadata
        );

        // Create outbound message with proper routing
        const { data: message, error: messageError } = await supabaseAdmin
          .from("messages")
          .insert({
            tenant_id: campaign.tenant_id,
            gateway_id: gateway.id,
            direction: "outbound",
            from_number: gateway.phone_number,
            to_number: recipient.phone_number,
            content: personalizedContent,
            resolved_group_id: targetGroup.id,
            status: "pending",
            thread_key: `${gateway.phone_number}:${recipient.phone_number}`,
            thread_subject: campaign.subject || "Bulk utsendelse",
          })
          .select()
          .single();

        if (messageError) {
          console.error(`❌ Failed to create message for ${recipient.phone_number}:`, messageError);
          throw new Error(messageError.message);
        }

        console.log(`✅ Message created: ${message.id}`);

        // Update recipient status
        await supabaseAdmin
          .from("bulk_recipients")
          .update({
            status: "sent",
            sent_message_id: message.id,
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        // Trigger outbound message processing via Edge Function
        try {
          const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/outbound-message`;
          console.log(`🔔 Triggering outbound processing for message ${message.id}...`);
          
          const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ message_id: message.id }),
          });

          if (!response.ok) {
            console.warn(`⚠️ Outbound trigger failed (${response.status}), but continuing...`);
          } else {
            console.log(`✅ Outbound processing triggered`);
          }
        } catch (triggerError) {
          console.error("⚠️ Failed to trigger outbound processing:", triggerError);
          // Continue anyway - message is created and will be picked up
        }

        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to send to ${recipient.phone_number}:`, error);

        await supabaseAdmin
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

    console.log(`✅ Processing complete: ${successCount} success, ${failedCount} failed`);

    // Update campaign final status
    const finalStatus = failedCount === 0 ? "completed" : failedCount === recipients.length ? "failed" : "completed";
    await supabaseAdmin
      .from("bulk_campaigns")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        sent_count: successCount,
        failed_count: failedCount,
      })
      .eq("id", campaign_id);

    console.log(`🎉 Campaign ${campaign_id} completed with status: ${finalStatus}`);

    return res.status(200).json({
      status: "success",
      campaign_id: campaign_id,
      total: recipients.length,
      success: successCount,
      failed: failedCount,
    });
  } catch (error: any) {
    console.error("💥 Bulk campaign error:", error);
    console.error("💥 Error message:", error.message);
    console.error("💥 Error stack:", error.stack);
    
    return res.status(500).json({ 
      error: error.message || "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
}

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