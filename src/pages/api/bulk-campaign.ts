import { NextApiRequest, NextApiResponse } from "next";

// Simplified version to debug 504 timeout
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("🚀 HANDLER STARTED");
  
  // Set timeout to prevent hanging
  const timeoutId = setTimeout(() => {
    console.error("⏱️ TIMEOUT REACHED - Force responding");
    if (!res.headersSent) {
      res.status(408).json({ error: "Request timeout" });
    }
  }, 25000); // 25 seconds (before CloudFront 30s timeout)

  try {
    console.log("📝 Setting CORS headers");
    
    // Add CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      console.log("✅ OPTIONS request handled");
      clearTimeout(timeoutId);
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      console.log("❌ Invalid method:", req.method);
      clearTimeout(timeoutId);
      return res.status(405).json({ error: "Method not allowed" });
    }

    console.log("📦 Request body:", JSON.stringify(req.body));

    // IMMEDIATE RESPONSE TEST
    console.log("✅ Sending immediate test response");
    clearTimeout(timeoutId);
    return res.status(200).json({
      status: "test_mode",
      message: "API route reached successfully",
      received: req.body,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("💥 Handler error:", error);
    clearTimeout(timeoutId);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: error.message || "Internal server error"
      });
    }
  }
}