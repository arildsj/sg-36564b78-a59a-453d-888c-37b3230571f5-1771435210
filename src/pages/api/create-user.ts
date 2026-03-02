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
    const { email, password, full_name, phone, role, tenant_id, group_ids } = req.body;

    if (!email || !password || !full_name || !role || !tenant_id) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["email", "password", "full_name", "role", "tenant_id"]
      });
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

    console.log("Invoking Edge Function create-user with:", {
      email,
      full_name,
      phone,
      role,
      tenant_id,
      group_ids: group_ids?.length || 0
    });

    // Invoke Edge Function
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      "create-user",
      {
        body: { 
          email, 
          password, 
          full_name, 
          phone, 
          role, 
          tenant_id, 
          group_ids 
        },
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
      });

      return res.status(500).json({
        error: "Failed to create user",
        details: functionError.message || "Edge Function returned an error",
        fullError: {
          name: functionError.name,
          message: functionError.message,
          context: functionError.context,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "User created successfully",
      data: functionData,
    });
  } catch (error) {
    console.error("API route error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}