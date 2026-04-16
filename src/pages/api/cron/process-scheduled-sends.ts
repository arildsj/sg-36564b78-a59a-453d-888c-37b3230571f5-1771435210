import { NextApiRequest, NextApiResponse } from "next";
import { createAdminClient } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Vercel cron auth
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`)
    return res.status(401).json({ error: "Unauthorized" });

  const admin = createAdminClient();

  // Find all scheduled campaigns whose send time has arrived
  const { data: campaigns, error: fetchError } = await admin
    .from("bulk_campaigns")
    .select("id, name, tenant_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  if (fetchError) {
    console.error("[process-scheduled-sends] Failed to fetch campaigns:", fetchError);
    return res.status(500).json({ error: "Failed to fetch scheduled campaigns" });
  }

  if (!campaigns?.length)
    return res.status(200).json({ processed: 0 });

  const results: Array<{ campaign_id: string; status: "ok" | "error"; detail?: string }> = [];

  for (const campaign of campaigns) {
    try {
      const { data, error } = await admin.functions.invoke("bulk-campaign", {
        body: { campaignId: campaign.id },
      });

      if (error) throw new Error(error.message || "Edge Function error");
      if (data && typeof data === "object" && "error" in data) throw new Error(String(data.error));

      console.log(
        `[process-scheduled-sends] Campaign ${campaign.id} (${campaign.name}) done:`,
        `sent=${data?.sent ?? "?"}, failed=${data?.failed ?? "?"}`
      );
      results.push({ campaign_id: campaign.id, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[process-scheduled-sends] Campaign ${campaign.id} (${campaign.name}) failed:`,
        message
      );

      // Explicitly mark failed so the campaign does not silently linger in 'scheduled'
      await admin
        .from("bulk_campaigns")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", campaign.id);

      results.push({ campaign_id: campaign.id, status: "error", detail: message });
    }
  }

  const succeeded = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(`[process-scheduled-sends] ${succeeded} succeeded, ${failed} failed`);
  return res.status(200).json({ processed: campaigns.length, succeeded, failed, results });
}
