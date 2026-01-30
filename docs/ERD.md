# SeMSe + FairGateway: Entity Relationship Diagram

## Core Entities & Relationships

### Multi-Tenancy Foundation
```
tenants (1) ──< tenant_settings (1)
tenants (1) ──< user_profiles (*)
tenants (1) ──< groups (*)
tenants (1) ──< contacts (*)
tenants (1) ──< gateways (*)
tenants (1) ──< whitelisted_numbers (*)
tenants (1) ──< routing_rules (*)
tenants (1) ──< auto_replies (*)
tenants (1) ──< bulk_campaigns (*)
tenants (1) ──< audit_log (*)
tenants (1) ──< import_jobs (*)
tenants (1) ──< simulation_scenarios (*)
```

### User & Group Relationships
```
user_profiles (1) ──< group_memberships (*) >── groups (*)
user_profiles (1) ──< on_duty_state (*) >── groups (*)
groups (1) ──< groups (*) [self-referential hierarchy via parent_group_id]
groups (1) ──< opening_hours (*)
groups (1) ──< opening_hour_exceptions (*)
```

### Contact Management
```
contacts (1) ──< contact_phones (*)
contacts (*) ──< group_contacts (*) >── groups (*)
```

### Gateway & Messaging
```
gateways (1) ──< gateway_fallback_inboxes (1)
gateways (1) ──< message_threads (*)
gateways (1) ──< messages (*)
gateways (1) ──< delivery_status_events (*)
```

### Message Threading
```
message_threads (1) ──< messages (*)
groups (1) ──< message_threads (*)
groups (1) ──< messages (*) [via resolved_group_id]
```

### Routing & Automation
```
gateways (1) ──< routing_rules (*)
groups (1) ──< routing_rules (*) [target_group_id]
groups (1) ──< auto_replies (*)
```

### Whitelist System
```
whitelisted_numbers (*) ──< whitelisted_number_group_links (*) >── groups (*)
```

### Bulk Campaigns
```
bulk_campaigns (1) ──< bulk_recipients (*)
bulk_recipients (*) >── contacts (*)
bulk_recipients (*) >── messages (*) [nullable]
groups (1) ──< bulk_campaigns (*)
gateways (1) ──< bulk_campaigns (*)
```

### Simulation & Testing
```
simulation_scenarios (1) ──< simulation_events (*)
```

## Key Constraints & Rules

### Tenant Isolation
- All tables include `tenant_id` (except auth.users reference in user_profiles)
- RLS enforces tenant boundaries at database level
- No cross-tenant data access permitted

### Hierarchical Groups
- `parent_group_id` enables unlimited depth
- `path` materialized as TEXT[] for efficient ancestor queries
- `depth` integer for quick level checks
- Only `operational` groups have inboxes (messages)
- `structural` groups organize hierarchy only

### Message Routing Guarantees
- Every message has `resolved_group_id` (operational group)
- Thread ensures reply returns to originating group
- `from_number` + `to_number` always in E.164 format
- `idempotency_key` prevents duplicate sends

### Access Control Levels
1. **Tenant Admin**: Full tenant scope
2. **Group Admin**: Subtree scope (group + descendants)
3. **Member**: Group membership scope
4. **On-Duty**: State flag, not permission

### Audit Trail
- Append-only `audit_log` table
- No UPDATE/DELETE operations allowed
- Logged actions: user changes, routing, auto-replies, imports, escalations
- Scope: tenant | group | gateway | system

### Soft Deletes
- All user-facing entities use `deleted_at TIMESTAMPTZ`
- Queries filter `WHERE deleted_at IS NULL`
- Preserves referential integrity and audit trail

## Indexes Strategy

### Tenant Isolation Indexes
- `(tenant_id)` on all tenant-scoped tables
- `(tenant_id, created_at DESC)` for time-based queries

### Group Hierarchy Indexes
- `(parent_group_id)` for child lookups
- `USING GIN(path)` for ancestor queries
- `(tenant_id, kind)` for operational vs structural

### Message Performance
- `(thread_id, created_at DESC)` for conversation history
- `(resolved_group_id, created_at DESC)` for inbox views
- `(status)` for delivery tracking
- `(idempotency_key)` for duplicate prevention

### Phone Number Lookups
- `(phone_number)` on contact_phones, whitelisted_numbers, gateways
- E.164 format enforced via CHECK constraint

### Audit & Compliance
- `(tenant_id, created_at DESC)` on audit_log
- `(entity_type, entity_id, created_at DESC)` for entity history

## Data Flow Patterns

### Inbound Message Flow
```
Gateway Webhook → delivery_status_events
  → Routing Engine (routing_rules)
  → find_or_create_contact()
  → get_or_create_thread()
  → messages (resolved_group_id set)
  → Auto-reply check (auto_replies)
  → Audit log entry
```

### Outbound Message Flow
```
User sends message (messages INSERT)
  → Validate group membership (RLS)
  → Thread lookup/create
  → Gateway API call (external)
  → delivery_status_events (webhook)
  → Update message status
  → Audit log entry
```

### Bulk Campaign Flow
```
bulk_campaigns (draft) → bulk_recipients (pending)
  → Schedule/execute
  → Create messages per recipient
  → Track in bulk_recipients (status updates)
  → Update campaign counts (trigger)
  → Audit log completion
```

## Security Boundaries

### RLS Policy Summary
- **Tenant-wide**: tenants, tenant_settings, gateways, routing_rules
- **Group-scoped**: messages, message_threads, contacts (via group_contacts), campaigns
- **User-owned**: on_duty_state, own profile updates
- **Admin-only**: audit_log (read), user_profiles (write), import_jobs

### Function Security
- `SECURITY DEFINER` for: audit logging, contact/thread creation, RLS helpers
- `SECURITY INVOKER` for: data queries, user-accessible utilities

## Schema Version
- Migration: 001 (initial schema)
- Migration: 002 (RLS policies)
- Migration: 003 (audit functions)
- Migration: 004 (helper functions)
- Compatible with Supabase PostgreSQL 15+