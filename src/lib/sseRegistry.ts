/**
 * In-process SSE client registry.
 *
 * Maps gateway_id → a send function for the active SSE connection.
 *
 * Limitation: this Map only exists within a single process/instance.
 * On Vercel, Edge Runtime (events.ts) and Node.js Runtime (inbox API)
 * are isolated — they will NOT share this Map.
 * The polling fallback in /api/mobile/messages handles that case.
 * In local dev (single process) the push path works end-to-end.
 */
type SseSender = (data: string) => void;

export const sseClients = new Map<string, SseSender>();
