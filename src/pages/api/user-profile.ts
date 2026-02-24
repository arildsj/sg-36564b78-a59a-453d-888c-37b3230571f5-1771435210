import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

interface UserProfileResponse {
  success: boolean;
  data?: any;
  error?: string;
  debug?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserProfileResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ 
      success: false, 
      error: "Method not allowed" 
    });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error("❌ Missing authorization header");
      return res.status(401).json({
        success: false,
        error: "Missing authorization header"
      });
    }

    const token = authHeader.replace("Bearer ", "");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Missing Supabase environment variables");
      return res.status(500).json({
        success: false,
        error: "Server configuration error"
      });
    }

    console.log("🔑 Creating Supabase Admin Client with Service Role Key");
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log("🔍 Verifying user token...");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error("❌ Token validation failed:", authError?.message);
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
        debug: { authError: authError?.message }
      });
    }

    console.log("✅ User authenticated:", user.id);
    console.log("📊 Fetching user profile with Service Role (bypasses RLS)...");

    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("❌ Error fetching user profile:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      return res.status(500).json({
        success: false,
        error: error.message,
        debug: {
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      });
    }

    if (!data) {
      console.warn("⚠️ User profile not found for user:", user.id);
      return res.status(404).json({
        success: false,
        error: "User profile not found"
      });
    }

    console.log("✅ User profile fetched successfully:", {
      id: data.id,
      email: data.email,
      role: data.role
    });

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error("❌ Unexpected error in /api/user-profile:", {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      debug: {
        name: error.name,
        stack: error.stack
      }
    });
  }
}