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

    // Get Supabase credentials from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Supabase credentials missing" });
    }

    // Get auth token from request
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized - no auth token" });
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    console.log("Invoking Edge Function with campaign_id:", campaign_id);

    // Invoke Edge Function
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      "bulk-campaign",
      {
        body: { campaign_id },
      }
    );

    // Log the full response for debugging
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