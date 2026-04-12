/**
 * GET /api/mobile/v1/events — SSE stream for FairGateway
 *
 * FairGateway connects here and receives outbound messages in real time.
 * Requires Edge Runtime for long-lived streaming on Vercel.
 */
import { createClient } from "@supabase/supabase-js";
import { sseClients } from "@/lib/sseRegistry";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Auth: Bearer device_token ─────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing Bearer token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Validate device_token against sms_gateways ────────────────────────────
  // createClient works in Edge Runtime; we can't import from @/lib/supabaseAdmin
  // (that file imports NextApiRequest from "next", a Node.js type).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;

  const { data: gateway } = await db
    .from("sms_gateways")
    .select("id, tenant_id")
    .eq("device_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!gateway) {
    return new Response(JSON.stringify({ error: "Invalid device token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const gatewayId = gateway.id as string;
  const encoder   = new TextEncoder();

  // ── SSE stream ────────────────────────────────────────────────────────────
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Connection closed — ignore write errors
        }
      };

      // Register in shared map so outbound messages can push immediately
      sseClients.set(gatewayId, send);

      // Initial handshake frame
      send(": connected\n\n");

      // Keepalive every 30 s to prevent proxy timeouts
      const keepalive = setInterval(() => {
        send(": keepalive\n\n");
      }, 30_000);

      // Clean up when FairGateway disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        sseClients.delete(gatewayId);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
