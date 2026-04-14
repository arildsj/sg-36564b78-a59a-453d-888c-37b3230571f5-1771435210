/**
 * POST /api/mobile/notify — internal endpoint
 *
 * Called fire-and-forget from messageService.sendMessage() after an outbound
 * message is saved to DB. If the destination gateway has an active SSE
 * connection in sseClients, the message:send event is pushed immediately.
 * If not connected, this is a no-op — FairGateway will pick it up via polling.
 */
import { NextApiRequest, NextApiResponse } from "next";
import { getRequestUser } from "@/lib/supabaseAdmin";
import { sseClients } from "@/lib/sseRegistry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // Caller must be an authenticated SeMSe user
  const user = await getRequestUser(req);
  if (!user)
    return res.status(401).json({ error: "Unauthorized" });

  const { gateway_id, message } = req.body;
  if (!gateway_id || !message)
    return res.status(400).json({ error: "gateway_id and message are required" });

  const send = sseClients.get(gateway_id);

  if (send) {
    const event =
      `event: MessageEnqueued\n` +
      `data: null\n\n`;
    send(event);
  }

  // Always 200 — SSE push is best-effort; polling covers the offline case
  return res.status(200).json({ pushed: !!send });
}
