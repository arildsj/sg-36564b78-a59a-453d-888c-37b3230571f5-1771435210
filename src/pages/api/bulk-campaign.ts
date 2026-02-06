import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("🚀 Bulk Campaign API Handler Started");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { campaign_id } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ error: "campaign_id is required" });
    }

    console.log("📋 Processing campaign:", campaign_id);

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error("❌ Campaign not found:", campaignError);
      return res.status(404).json({ error: "Campaign not found" });
    }

    console.log("✅ Campaign found:", campaign.name);

    // Update campaign status to sending
    await supabase
      .from("bulk_campaigns")
      .update({ status: "sending" })
      .eq("id", campaign_id);

    // Get pending recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from("bulk_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    if (recipientsError || !recipients || recipients.length === 0) {
      console.error("❌ No recipients found:", recipientsError);
      await supabase
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);
      return res.status(400).json({ error: "No recipients found" });
    }

    console.log(`📤 Sending to ${recipients.length} recipients`);

    // Get gateway for source group
    const { data: group } = await supabase
      .from("groups")
      .select("gateway_id, gateways(phone_number)")
      .eq("id", campaign.source_group_id)
      .single();

    if (!group?.gateway_id) {
      console.error("❌ No gateway found for group");
      await supabase
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);
      return res.status(400).json({ error: "No gateway configured for group" });
    }

    const gatewayPhone = (group.gateways as any).phone_number;

    // Send messages to each recipient
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        // Create or find thread for this recipient
        const { data: existingThread } = await supabase
          .from("message_threads")
          .select("id")
          .eq("group_id", campaign.source_group_id)
          .eq("phone_number", recipient.phone_number)
          .eq("campaign_id", campaign_id)
          .maybeSingle();

        let threadId = existingThread?.id;

        if (!threadId) {
          const { data: newThread } = await supabase
            .from("message_threads")
            .insert({
              group_id: campaign.source_group_id,
              phone_number: recipient.phone_number,
              subject: campaign.subject_line,
              campaign_id: campaign_id,
              last_message_at: new Date().toISOString()
            })
            .select()
            .single();

          threadId = newThread?.id;
        }

        if (!threadId) {
          throw new Error("Failed to create thread");
        }

        // Create outbound message
        const { data: message, error: messageError } = await supabase
          .from("messages")
          .insert({
            thread_id: threadId,
            direction: "outbound",
            from_number: gatewayPhone,
            to_number: recipient.phone_number,
            content: campaign.message_template,
            status: "sent",
            campaign_id: campaign_id,
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        if (messageError) {
          throw messageError;
        }

        // Update recipient status
        await supabase
          .from("bulk_recipients")
          .update({
            status: "sent",
            sent_message_id: message.id,
            sent_thread_id: threadId,
            sent_at: new Date().toISOString()
          })
          .eq("id", recipient.id);

        successCount++;
        console.log(`✅ Sent to ${recipient.phone_number}`);

      } catch (error: any) {
        failCount++;
        console.error(`❌ Failed to send to ${recipient.phone_number}:`, error);

        await supabase
          .from("bulk_recipients")
          .update({
            status: "failed",
            error_message: error.message
          })
          .eq("id", recipient.id);
      }
    }

    // Update campaign final status
    const finalStatus = failCount === recipients.length ? "failed" : "sent";
    await supabase
      .from("bulk_campaigns")
      .update({
        status: finalStatus,
        sent_count: successCount,
        failed_count: failCount
      })
      .eq("id", campaign_id);

    console.log(`✅ Campaign completed: ${successCount} sent, ${failCount} failed`);

    return res.status(200).json({
      success: true,
      campaign_id,
      sent: successCount,
      failed: failCount,
      total: recipients.length
    });

  } catch (error: any) {
    console.error("💥 API handler error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}