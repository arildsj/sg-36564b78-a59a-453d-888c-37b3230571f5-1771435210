import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const projectRef = "vrbzjgvdlnkffwjhbvkh";
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  console.log("Testing Supabase Management API...");
  console.log("Access Token exists:", !!accessToken);
  console.log("Access Token length:", accessToken?.length || 0);

  if (!accessToken) {
    return res.status(500).json({ 
      error: "No access token found",
      hasToken: false
    });
  }

  try {
    // Try to fetch project API keys from Supabase Management API
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Management API response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Management API error:", errorText);
      return res.status(response.status).json({ 
        error: "Failed to fetch API keys",
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    console.log("Successfully fetched API keys");

    // Return the keys (anon and service_role)
    return res.status(200).json({
      success: true,
      keys: data
    });

  } catch (error: any) {
    console.error("Error fetching API keys:", error);
    return res.status(500).json({ 
      error: error.message,
      hasToken: !!accessToken
    });
  }
}