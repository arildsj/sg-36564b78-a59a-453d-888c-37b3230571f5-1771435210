import { NextApiRequest, NextApiResponse } from "next";
import { createAdminClient } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ── Basic auth decode ─────────────────────────────────────────────────────
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Basic "))
    return res.status(401).json({ error: "Missing Basic auth" });

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const colonIdx = decoded.indexOf(":");
  if (colonIdx === -1)
    return res.status(401).json({ error: "Malformed Basic auth" });

  const api_key    = decoded.slice(0, colonIdx);
  const api_secret = decoded.slice(colonIdx + 1);

  if (!api_key || !api_secret)
    return res.status(401).json({ error: "Missing credentials" });

  // ── Gateway lookup ────────────────────────────────────────────────────────
  const admin = createAdminClient() as any;

  const { data: gateway, error } = await admin
    .from("sms_gateways")
    .select("id, api_key, api_secret, device_token")
    .eq("api_key", api_key)
    .eq("api_secret", api_secret)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !gateway)
    return res.status(401).json({ error: "Invalid credentials" });

  // ── Return existing token or generate new one ─────────────────────────────
  let token: string = gateway.device_token;

  if (!token) {
    token = crypto.randomUUID();
    await admin
      .from("sms_gateways")
      .update({ device_token: token })
      .eq("id", gateway.id);
  }

  return res.status(200).json({
    id:       gateway.id,
    token,
    login:    api_key,
    password: api_secret,
  });
}
