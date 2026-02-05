import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("🧪 Test API called");
  
  try {
    // Test 1: Basic response
    console.log("✅ Test 1: Handler executing");
    
    // Test 2: Environment variables
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log("🔑 Environment check:", { hasUrl, hasAnonKey, hasServiceKey });
    
    // Test 3: Import Supabase
    const { createClient } = await import("@supabase/supabase-js");
    console.log("✅ Test 3: Supabase import successful");
    
    // Test 4: Create client
    if (!hasUrl || !hasServiceKey) {
      throw new Error("Missing required environment variables");
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log("✅ Test 4: Supabase client created");
    
    // Test 5: Simple query
    const { data, error } = await supabase
      .from("bulk_campaigns")
      .select("id")
      .limit(1);
    
    console.log("✅ Test 5: Query executed", { hasData: !!data, error });
    
    return res.status(200).json({
      success: true,
      tests: {
        handler: true,
        environment: { hasUrl, hasAnonKey, hasServiceKey },
        supabaseImport: true,
        supabaseClient: true,
        query: { hasData: !!data, hasError: !!error }
      }
    });
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error("❌ Stack:", error.stack);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}