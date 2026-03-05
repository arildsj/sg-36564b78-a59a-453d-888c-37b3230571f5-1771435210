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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Supabase credentials missing" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized - no auth token" });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    console.log("Invoking Edge Function with campaign_id:", campaign_id);

    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      "bulk-campaign",
      {
        body: { campaign_id },
      }
    );

    console.log("Edge Function response:", {
      data: functionData,
      error: functionError,
      hasError: !!functionError,
    });

    if (functionError) {
      console.error("Edge Function error details:", {
        name: functionError.name,
        message: functionError.message,
        context: functionError.context,
        status: functionError.context?.status,
        statusText: functionError.context?.statusText,
      });

      return res.status(500).json({
        error: "Failed to trigger campaign",
        details: functionError.message || "Edge Function returned a non-2xx status code",
        fullError: {
          name: functionError.name,
          message: functionError.message,
          context: functionError.context,
        },
      });
    }

    if (functionData && typeof functionData === "object" && "error" in functionData) {
      console.error("Edge Function returned error in data:", functionData);
      return res.status(500).json({
        error: "Campaign processing failed",
        details: functionData.error || "Unknown error from Edge Function",
        data: functionData,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Campaign processing started",
      data: functionData,
    });
  } catch (error) {
    console.error("API route error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}