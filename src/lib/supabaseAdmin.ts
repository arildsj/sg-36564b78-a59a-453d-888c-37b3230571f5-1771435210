import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextApiRequest } from "next";

/**
 * Returns a Supabase client with the service role key.
 * Must only be used server-side (API routes).
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Extracts and verifies the caller's JWT from the Authorization header.
 * Returns the authenticated user, or null if missing/invalid.
 */
export async function getRequestUser(req: NextApiRequest) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  // Use anon key + token to verify (does not bypass RLS)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * Returns the user's profile row (role, tenant_id) using the admin client.
 */
export async function getUserProfile(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, role, tenant_id, full_name")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`Could not load user profile: ${error.message}`);
  return data as { id: string; role: string; tenant_id: string; full_name: string };
}
