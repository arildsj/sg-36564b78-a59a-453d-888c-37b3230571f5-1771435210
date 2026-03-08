import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { functionName } = req.body;

    if (!functionName) {
      return res.status(400).json({ error: "Function name is required" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Missing Supabase credentials" });
    }

    const projectRef = supabaseUrl.split("//")[1].split(".")[0];

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/functions/${functionName}/deploy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Deployment failed:", error);
      return res.status(response.status).json({ error });
    }

    const result = await response.json();

    return res.status(200).json({
      success: true,
      message: `Function ${functionName} deployed successfully`,
      result,
    });
  } catch (error: unknown) {
    console.error("Deployment error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}