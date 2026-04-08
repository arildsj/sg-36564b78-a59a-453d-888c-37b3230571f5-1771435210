# CLAUDE.md — SeMSe Project Notes

## Deployment

- **Vercel** handles automatic deployment. Every push to `main` triggers a new deploy.
- **Softgen** is used for visual/UI editing only — do not rely on it for code logic.
- The `work` branch mirrors `main` and is kept in sync after each commit.

## Stack

- Next.js 15 + TypeScript + Tailwind CSS + Radix UI
- Supabase (PostgreSQL) — hosted, project ref: `eishfpakudxkamkwthtq`
- `database.types.ts` is **outdated** — do not trust it for actual column names. Always verify against the live DB via `npx supabase db query --linked`.

## Known DB Quirks

- `messages.campaign_id` is always `NULL` — never use it to filter messages.
- `messages` does **not** have `sent_at`, `delivered_at`, or `received_at` columns despite what `database.types.ts` says. Actual columns: `id, direction, from_number, to_number, content, status, external_id, created_at, tenant_id, campaign_id, group_id, thread_id`.
- Inbound reply messages are never tagged with `campaign_id`. Match them by `from_number IN (recipientPhones)` + `created_at >= campaign.created_at`.

## Completed Work

- Campaign detail dialog (`/sending` page): shows all recipients with reply status (Svart / Ingen respons), message IDs, timestamps, and response text.
- Reminder sending from campaign detail view: reminders appear inline under each recipient after sending.
- Inbound reply matching fixed: phone-based query instead of broken `campaign_id` filter.
- Contact grouping (`contact_groups` / `contact_group_members` tables).

## Current Focus

**Routing rules testing** — next area to work on.
