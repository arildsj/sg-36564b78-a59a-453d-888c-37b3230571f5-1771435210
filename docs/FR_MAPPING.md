# SeMSe + FairGateway: Functional Requirements Mapping

## Schema Implementation Traceability

This document maps the database schema to anticipated Functional Requirements (FR-IDs).
**NOTE**: FR-IDs will be formally defined in PROMPT 2. This is a reference framework.

## Core Multi-Tenancy (FR-TENANT-*)

### FR-TENANT-001: Tenant Isolation
**Schema**: `tenants`, `tenant_settings`, all `tenant_id` foreign keys
**RLS**: All policies filter by `auth.user_tenant_id()`
**Enforcement**: Row Level Security + database constraints

### FR-TENANT-002: Tenant Configuration
**Schema**: `tenant_settings` (timezone, business_hours_enabled, default_country_code, etc.)
**Functions**: N/A (direct CRUD via RLS)

### FR-TENANT-003: Tenant Status Management
**Schema**: `tenants.status` (active | suspended | archived)
**Audit**: `audit_log` tracks status changes

## User & Access Management (FR-USER-*)

### FR-USER-001: User Profiles
**Schema**: `user_profiles` (→ auth.users)
**RLS**: Users view same-tenant profiles, edit own
**Audit**: `audit_user_profile_changes()` trigger

### FR-USER-002: Role-Based Access
**Schema**: `user_profiles.role` (tenant_admin | group_admin | member)
**RLS**: Policies check `auth.is_tenant_admin()`, `auth.is_group_admin()`

### FR-USER-003: On-Duty State
**Schema**: `on_duty_state` (user ↔ operational group, is_on_duty flag)
**Functions**: `get_on_duty_users(p_group_id)`
**RLS**: Users manage own state

## Group Hierarchy (FR-GROUP-*)

### FR-GROUP-001: Hierarchical Groups
**Schema**: `groups` (parent_group_id, path, depth)
**Triggers**: `update_group_path()` maintains materialized path
**Functions**: `get_user_accessible_groups()`

### FR-GROUP-002: Group Kinds
**Schema**: `groups.kind` (structural | operational)
**Constraints**: Only operational groups have inboxes (message routing)

### FR-GROUP-003: Group Memberships
**Schema**: `group_memberships` (user ↔ group, is_admin)
**RLS**: Group admins manage memberships

### FR-GROUP-004: Opening Hours
**Schema**: `opening_hours` (day_of_week, open_time, close_time)
**Schema**: `opening_hour_exceptions` (exception_date, is_closed, etc.)
**RLS**: Group admins manage hours

## Contact Management (FR-CONTACT-*)

### FR-CONTACT-001: Contact Records
**Schema**: `contacts` (first_name, last_name, email, notes, metadata)
**Functions**: `find_or_create_contact()`
**RLS**: Viewable if linked to user's groups via `group_contacts`

### FR-CONTACT-002: Phone Numbers
**Schema**: `contact_phones` (phone_number E.164, is_primary)
**Constraints**: `validate_e164_phone()` enforces format
**Triggers**: `ensure_single_primary_phone()`

### FR-CONTACT-003: Group Association
**Schema**: `group_contacts` (contact ↔ group M:N)
**RLS**: Users see contacts linked to accessible groups

## Gateway Integration (FR-GATEWAY-*)

### FR-GATEWAY-001: FairGateway Configuration
**Schema**: `gateways` (name, phone_number, api_key_encrypted, status)
**RLS**: Tenant admins manage gateways
**Audit**: `audit_gateway_changes()` trigger

### FR-GATEWAY-002: Fallback Routing
**Schema**: `gateway_fallback_inboxes` (gateway → default group)
**Usage**: When no routing rules match

### FR-GATEWAY-003: Gateway Status
**Schema**: `gateways.status` (active | inactive | error)
**Audit**: Status changes logged

## Message Management (FR-MESSAGE-*)

### FR-MESSAGE-001: SMS/MMS Storage
**Schema**: `messages` (direction, from/to_number, content, mms_media_urls)
**Schema**: `message_threads` (conversation grouping)
**Functions**: `get_or_create_thread()`

### FR-MESSAGE-002: Threading
**Schema**: `message_threads` (group_id, external_number, gateway_id)
**Triggers**: `update_thread_timestamp()` on message insert
**Guarantee**: Replies return to originating group

### FR-MESSAGE-003: Delivery Tracking
**Schema**: `messages.status` (pending | sent | delivered | failed | received)
**Schema**: `delivery_status_events` (webhook event storage)
**Indexes**: `(status)`, `(external_id)` for webhook lookups

### FR-MESSAGE-004: Idempotency
**Schema**: `messages.idempotency_key` (unique constraint)
**Prevents**: Duplicate sends from retries

### FR-MESSAGE-005: Group Routing
**Schema**: `messages.resolved_group_id` (operational group)
**RLS**: Users only see messages for their groups

## Routing Engine (FR-ROUTE-*)

### FR-ROUTE-001: Dynamic Routing Rules
**Schema**: `routing_rules` (match_type, match_value, target_group_id, priority)
**Types**: keyword | sender | regex | time_based
**RLS**: Tenant admins manage rules
**Audit**: `audit_routing_rule_changes()` trigger

### FR-ROUTE-002: Priority-Based Matching
**Schema**: `routing_rules.priority` (higher = evaluated first)
**Indexes**: `(tenant_id, priority DESC, is_active)`

### FR-ROUTE-003: Fallback Routing
**Schema**: `gateway_fallback_inboxes` (default when no rules match)

## Auto-Reply System (FR-AUTO-*)

### FR-AUTO-001: Automated Responses
**Schema**: `auto_replies` (trigger_type, trigger_value, reply_template)
**Types**: keyword | after_hours | first_message
**RLS**: Tenant/group admins manage
**Audit**: `audit_auto_reply_changes()` trigger

### FR-AUTO-002: Business Hours Integration
**Logic**: Check `opening_hours` + `opening_hour_exceptions` for after_hours trigger
**Functions**: Will be in PROMPT 2 runtime logic

## Whitelist System (FR-WHITELIST-*)

### FR-WHITELIST-001: Number Whitelisting
**Schema**: `whitelisted_numbers` (phone_number, label)
**Schema**: `whitelisted_number_group_links` (whitelist ↔ group)
**Functions**: `is_number_whitelisted()`
**RLS**: Tenant admins manage

### FR-WHITELIST-002: Group-Specific Whitelists
**Schema**: `whitelisted_number_group_links` enables per-group whitelisting
**Usage**: Allow specific numbers to bypass routing rules for certain groups

## Bulk Campaigns (FR-BULK-*)

### FR-BULK-001: Campaign Creation
**Schema**: `bulk_campaigns` (name, message_template, status, scheduled_at)
**RLS**: Users create for their groups
**Audit**: `audit_bulk_campaign_changes()` trigger

### FR-BULK-002: Recipient Management
**Schema**: `bulk_recipients` (contact_id, phone_number, status)
**Triggers**: `update_campaign_counts()` maintains totals

### FR-BULK-003: Per-Recipient Tracking
**Schema**: `bulk_recipients.status` (pending | sent | delivered | failed)
**Schema**: `bulk_recipients.message_id` links to actual message
**Counts**: `bulk_campaigns.sent_count`, `failed_count`

## Audit & Compliance (FR-AUDIT-*)

### FR-AUDIT-001: Comprehensive Logging
**Schema**: `audit_log` (action_type, entity_type, entity_id, scope, metadata)
**Functions**: `log_audit_event()` (SECURITY DEFINER)
**Rules**: No UPDATE/DELETE allowed

### FR-AUDIT-002: Audit Trail Access
**RLS**: Only tenant admins view audit_log
**Functions**: `get_entity_audit_trail()` for entity history

### FR-AUDIT-003: Logged Actions
**Triggers**: user changes, routing, gateways, groups, auto-replies, campaigns, message sending
**Scope**: tenant | group | gateway | system

## Import & Export (FR-IMPORT-*)

### FR-IMPORT-001: Batch Contact Import
**Schema**: `import_jobs` (import_type, status, total_rows, errors)
**Types**: contacts | messages | bulk_recipients
**RLS**: Users track own imports, admins see all

### FR-IMPORT-002: Import Status Tracking
**Schema**: `import_jobs.status` (pending | processing | completed | failed)
**Counts**: `processed_rows`, `success_count`, `error_count`

## Simulation & Testing (FR-SIM-*)

### FR-SIM-001: Scenario Testing
**Schema**: `simulation_scenarios` (name, config, is_active)
**Schema**: `simulation_events` (event_type, from/to_number, delay_seconds)
**RLS**: Tenant admins manage

### FR-SIM-002: Event Execution
**Schema**: `simulation_events.executed_at` tracks completion
**Usage**: Training, testing routing logic without real SMS

## E.164 Phone Format (FR-PHONE-*)

### FR-PHONE-001: Format Enforcement
**Functions**: `validate_e164_phone()` (CHECK constraints on relevant tables)
**Tables**: contact_phones, whitelisted_numbers, gateways, messages (from/to_number)

### FR-PHONE-002: Country Code Support
**Schema**: `tenant_settings.default_country_code`
**Usage**: Format normalization in UI (PROMPT 2)

## Soft Delete (FR-DELETE-*)

### FR-DELETE-001: Soft Delete Pattern
**Schema**: `deleted_at TIMESTAMPTZ` on all user-facing tables
**Functions**: `soft_delete_entity()` helper
**Indexes**: All indexes filter `WHERE deleted_at IS NULL`

### FR-DELETE-002: Referential Integrity
**Constraints**: Foreign keys use `ON DELETE CASCADE` for hard deletes
**Audit**: Soft deletes logged in audit_log

## Notes

- **PROMPT 2 will define**: Exact FR-IDs, detailed acceptance criteria, runtime workflows
- **This schema supports**: All anticipated FRs based on system description
- **Extensions**: Schema can be extended via new migrations if PROMPT 2 adds requirements
- **No breaking changes**: RLS and audit infrastructure are foundational

## FR31001-FR31003: Escalation and Acknowledgement

**FR31001**: The system shall support escalation of inbound messages that remain unacknowledged for a configurable duration.

**Implementation**:
- **Schema**: `messages.acknowledged_at`, `messages.escalation_level`, `groups.escalation_enabled`, `groups.escalation_timeout_minutes`
- **Edge Function**: `escalate-messages` (scheduled via cron)
- **Logic**: Escalation levels (1=all members, 2=tenant admins, 3=capped)
- **Audit**: All escalation events logged in `escalation_events` + `audit_log`

**FR31002**: A message shall be considered acknowledged when an authorized user opens, assigns, or replies to it.

**Implementation**:
- **Schema**: `messages.acknowledged_at`, `messages.acknowledged_by_user_id`
- **Edge Function**: `acknowledge-message` (user-triggered)
- **UI**: Automatic acknowledgement on message open/reply
- **Idempotency**: Cannot be unacknowledged once set

**FR31003**: All escalation events shall be logged.

**Implementation**:
- **Schema**: `escalation_events` table + `audit_log` entries
- **Triggers**: Automatic on escalation
- **RLS**: Readable by tenant admins only

**Schema References**: `messages`, `escalation_events`, `groups`, `audit_log`

---

## FR31101-FR31106: Web Application (SeMSe)

**FR31101**: The web application shall notify on-duty users of new inbound messages.

**Implementation**:
- **Edge Function**: `inbound-message` calls `notifyOnDutyUsers()`
- **RLS**: Notifications only for authorized groups (FR31203)
- **Delivery**: In-app + email + push (configurable)
- **Status**: ⏳ UI implementation pending

**FR31102**: The web application shall allow authorized users to view and reply to messages.

**Implementation**:
- **RLS**: `messages` policies enforce group-scoped access
- **UI**: Inbox interface with thread view + reply form
- **Status**: ⏳ UI implementation pending

**FR31103**: The web application shall display the groups the user is authorized for.

**Implementation**:
- **RLS**: `groups` SELECT policy based on `auth.user_group_ids()`
- **UI**: Group selector/navigation
- **Status**: ⏳ UI implementation pending

**FR31104**: The web application shall display current on-duty coverage and open/closed status per group.

**Implementation**:
- **Query**: Join `on_duty_state` + `opening_hours` + `opening_hour_exceptions`
- **Logic**: Real-time evaluation of opening hours
- **UI**: Group status dashboard
- **Status**: ⏳ UI implementation pending

**FR31105**: The web application shall allow authorized users to manage on-duty status, opening hours, and automatic replies.

**Implementation**:
- **RLS**: `on_duty_state` policies allow self-management + admin override
- **RLS**: `opening_hours`, `auto_replies` policies enforce group admin scope
- **UI**: Settings panels per group
- **Status**: ⏳ UI implementation pending

**FR31106**: The web application shall provide a dedicated view for fallback inboxes.

**Implementation**:
- **Query**: Messages in groups marked as fallback inboxes
- **UI**: Dedicated fallback inbox view with classification action
- **Audit**: Classification logged (FR3706)
- **Status**: ⏳ UI implementation pending

**Schema References**: `messages`, `groups`, `on_duty_state`, `opening_hours`, `auto_replies`, `gateway_fallback_inboxes`

---

## FR31201-FR31203: Security and Compliance

**FR31201**: The system shall enforce least-privilege access based on group membership and administrative scope.

**Implementation**:
- **RLS**: All tables enforce tenant isolation + group-scoped access
- **Roles**: `tenant_admin`, `group_admin`, `member`
- **Functions**: `auth.is_tenant_admin()`, `auth.is_group_admin()`, `auth.user_group_ids()`
- **Validation**: RLS policies prevent cross-tenant and unauthorized group access

**FR31202**: All administrative and operational actions shall be auditable and traceable to a user identity.

**Implementation**:
- **Schema**: `audit_log` with `actor_user_id`
- **Triggers**: Automatic on key entity changes
- **RPC**: `log_audit_event` SECURITY DEFINER function
- **Coverage**: Groups, users, memberships, on-duty, routing, escalation, messages

**FR31203**: Notification mechanisms shall not expose message content to unauthorized users.

**Implementation**:
- **Notifications**: Show group name only, not content
- **RLS**: Message content accessible only after RLS policy check
- **Edge Functions**: `notifyOnDutyUsers()` does not include content in notification payload
- **UI**: User must open authenticated app to view content

**Schema References**: `audit_log`, `user_profiles`, `groups`, `group_memberships`, RLS policies

---

## Implementation Status Summary

| Category | FR Range | Schema | RLS | Logic | UI | Status |
|----------|----------|--------|-----|-------|----|---------| 
| Groups | FR3101-FR3109 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Users | FR3201-FR3208 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| On-Duty | FR3301-FR3309 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Contacts | FR3401-FR3407 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Imports | FR3501-FR3503 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Audit | FR3601-FR3606 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Routing | FR3701-FR3706 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Hours | FR3801-FR3803 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Auto-Reply | FR3901-FR3905 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Escalation | FR31001-FR31003 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |
| Web App | FR31101-FR31106 | ✅ | ✅ | ✅ | ⏳ | UI Pending |
| Security | FR31201-FR31203 | ✅ | ✅ | ✅ | ⏳ | Backend Complete |

**Legend**:
- ✅ Complete
- ⏳ Pending
- ❌ Not Started

---

## Compliance Notes

1. **No breaking changes**: All FR requirements implemented on top of PROMPT 1 schema
2. **Backward compatible**: Existing tables extended with new columns (acknowledgement, escalation)
3. **RLS preserved**: All new tables follow same tenant isolation patterns
4. **Audit complete**: All FR-required logging implemented
5. **UI ready**: Backend APIs support all FR31101-FR31106 requirements

---

**Document Status**: ✅ Complete
**FR Coverage**: 100% (Schema + Backend Logic)
**Production Ready**: ⚠️ UI implementation required for FR31101-FR31106