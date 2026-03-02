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

    // Validate required fields
    if (!email || !password || !full_name || !phone || !role || !tenant_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const authHeader = req.headers.authorization;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Missing Supabase configuration" });
    }

    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Invoke Edge Function
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email, password, full_name, phone, role, tenant_id, group_ids },
    });

    if (error) {
      console.error("Edge Function error:", error);
      return res.status(500).json({
        error: "Failed to create user",
        details: error.message || "Edge Function returned a non-2xx status code",
        fullError: error,
      });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error("API route error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}