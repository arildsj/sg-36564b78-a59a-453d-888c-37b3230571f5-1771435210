import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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
      return res.status(400).json({ error: "campaign_id is required" });
    }

    // Use anon key with authorization header from client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Get authorization token from request
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized - no auth token" });
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    console.log(`🚀 Triggering bulk campaign: ${campaign_id}`);

    // Call the bulk-campaign Edge Function
    const { data, error } = await supabase.functions.invoke("bulk-campaign", {
      body: { campaign_id },
    });

    if (error) {
      console.error("❌ Edge Function error:", error);
      return res.status(500).json({
        error: "Failed to trigger campaign",
        details: error.message,
      });
    }

    console.log("✅ Campaign triggered successfully:", data);

    return res.status(200).json({
      success: true,
      message: "Campaign processing started",
      data,
    });
  } catch (error: unknown) {
    console.error("❌ Bulk campaign API error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}