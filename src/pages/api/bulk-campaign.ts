import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";

// Use service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { campaign_id } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ error: "Missing campaign_id" });
    }

    // Fetch campaign with recipients
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("bulk_campaigns")
      .select(`
        *,
        bulk_recipients (*)
      `)
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.status !== "draft") {
      return res.status(400).json({ 
        error: "Campaign already processed", 
        status: campaign.status 
      });
    }

    // Update campaign status to processing
    await supabaseAdmin
      .from("bulk_campaigns")
      .update({ 
        status: "sending",
        sent_at: new Date().toISOString(),
        total_recipients: campaign.bulk_recipients?.length || 0
      })
      .eq("id", campaign_id);

    // Get active gateways for load distribution
    const { data: gateways } = await supabaseAdmin
      .from("gateways")
      .select("id, phone_number")
      .eq("tenant_id", campaign.tenant_id)
      .eq("status", "active");

    if (!gateways || gateways.length === 0) {
      await supabaseAdmin
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);

      return res.status(400).json({ error: "No active gateways available" });
    }

    // Get target group for message routing
    const { data: targetGroup } = await supabaseAdmin
      .from("groups")
      .select("id, kind")
      .eq("id", campaign.target_group_id)
      .single();

    if (!targetGroup) {
      await supabaseAdmin
        .from("bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);

      return res.status(400).json({ error: "Target group not found" });
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
          throw new Error(messageError.message);
        }

        // Update recipient status
        await supabaseAdmin
          .from("bulk_recipients")
          .update({
            status: "sent",
            sent_message_id: message.id,
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        // Trigger outbound message processing via API
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/outbound-message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ message_id: message.id }),
          });
        } catch (triggerError) {
          console.error("Failed to trigger outbound processing:", triggerError);
          // Continue anyway - message is created and will be picked up
        }

        successCount++;
      } catch (error: any) {
        console.error(`Failed to send to ${recipient.phone_number}:`, error);

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

    return res.status(200).json({
      status: "success",
      campaign_id: campaign_id,
      total: recipients.length,
      success: successCount,
      failed: failedCount,
    });
  } catch (error: any) {
    console.error("Bulk campaign error:", error);
    return res.status(500).json({ error: error.message });
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