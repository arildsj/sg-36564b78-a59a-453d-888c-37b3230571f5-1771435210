# SeMSe + FairGateway: Runtime Logic Specification

## PROMPT 2 Implementation: Deterministic Workflows + FR Compliance

---

## 1. MESSAGE INGESTION & ROUTING

### Inbound Message Flow

**Endpoint**: `supabase/functions/inbound-message`

**Process**:
1. **Idempotency Check**: Validate `idempotency_key = gateway_id:external_message_id`
2. **Gateway Validation**: Verify gateway is active and belongs to tenant
3. **Phone Normalization**: Convert to E.164 format
4. **Thread Resolution**: Check for existing thread (reply scenario)
5. **Sender Classification**:
   - **Known**: Whitelisted number → resolve candidate groups (FR3401-FR3407)
   - **Unknown**: Route to fallback inbox (FR3703-FR3705)
6. **Routing Rule Evaluation**: Apply rules by priority (descending) (FR3702)
7. **Thread Creation**: Deterministic thread binding
8. **Message Persistence**: Create message record (unacknowledged by default - FR31002)
9. **Auto-Reply Evaluation**: Check conditions and cooldown (FR3901-FR3905)
10. **On-Duty Notification**: Notify only on-duty users (FR3301, FR31101)
11. **Escalation Scheduling**: Schedule escalation check if enabled (FR31001)

### Routing Rule Types (FR3702)

| Rule Type | Matching Logic | Example |
|-----------|----------------|---------|
| `prefix` | `content.startsWith(pattern)` | "HELP" matches "HELP me" |
| `keyword` | Word boundary match `\b{pattern}\b` | "appointment" matches "need appointment" |
| `exact` | Exact string match | "YES" only matches "YES" |

**Priority**: Integer field, descending order (highest priority first)

**First Match Wins**: Evaluation stops at first matching rule

### Thread Binding (FR3701)

**Rule**: Replies MUST return to originating operational group

**Implementation**: Thread key = `tenant_id + contact_phone + resolved_group_id`

**Guarantee**: Same contact + group = same thread

### Fallback Inbox (FR3703-FR3706)

**Configuration**: Each FairGateway instance has exactly one fallback inbox (FR3704)

**Behavior**:
- Unknown senders → fallback inbox
- Messages remain until manual classification (FR3705)
- All classification logged (FR3706)

---

## 2. MESSAGE ACKNOWLEDGEMENT & ESCALATION

### Acknowledgement Tracking (FR31002)

**Endpoint**: `supabase/functions/acknowledge-message`

**Definition**: A message is acknowledged when an authorized user:
- Opens the message in the inbox
- Assigns the message to themselves or another user
- Replies to the message

**Implementation**:
- `acknowledged_at` timestamp set on first acknowledgement action
- `acknowledged_by_user_id` records who acknowledged
- Only inbound messages require acknowledgement
- Acknowledgement is idempotent (cannot be unacknowledged)

**Audit**: All acknowledgements logged (FR31003)

### Escalation Logic (FR31001-FR31003)

**Endpoint**: `supabase/functions/escalate-messages` (scheduled via cron)

**Configuration** (per operational group):
- `escalation_enabled`: Boolean flag
- `escalation_timeout_minutes`: Time before escalation (default: 30 minutes)

**Escalation Levels**:
1. **Level 1** (First escalation): Notify ALL group members (not just on-duty)
2. **Level 2** (Second escalation): Notify tenant administrators
3. **Level 3+**: Capped (no further escalation)

**Trigger**: Unacknowledged inbound message exceeds timeout threshold

**Process**:
1. Find all groups with `escalation_enabled = true`
2. Query unacknowledged messages older than `escalation_timeout_minutes`
3. Increment `escalation_level` on message
4. Create `escalation_events` record
5. Notify escalation targets
6. Log escalation event (FR31003)

**Prevention**: Acknowledging a message stops all future escalation

---

## 3. OPENING HOURS & AUTO-REPLIES

### Opening Hours Evaluation (FR3801-FR3803)

**Timezone-Aware**: All times evaluated in group's configured timezone (FR3803)

**Priority**:
1. Date exceptions (highest) (FR3802)
2. Weekly schedule (FR3802)
3. Default to closed if no schedule

**Function**: `checkOpeningHours(groupId)` → boolean

### Auto-Reply Conditions (FR3901-FR3905)

**Trigger Types**:
- `outside_hours`: Send only when group is closed (FR3902)
- `keyword`: Match trigger_keywords (case-insensitive, partial match)
- `first_message`: Send on thread creation

**Cooldown**: Per-thread cooldown prevents spam (FR3904)

**Execution**:
- Sent without requiring on-duty users (FR3903)
- Logged with triggering message link (FR3905)
- Multiple templates supported per group (FR3902)

**Priority**: First matching auto-reply wins

---

## 4. ON-DUTY COVERAGE & NOTIFICATIONS

### On-Duty State (FR3301-FR3309)

**Scope**: Per user, per operational group (FR3302)

**Rules**:
- Only on-duty users receive message notifications (FR3301)
- User may be on-duty in multiple groups simultaneously (FR3304)
- Only group members can be set on-duty (FR3305)
- Users can manage their own on-duty status (FR3306)
- Group admins can manage others' status (FR3307)
- Minimum on-duty count enforced (FR3308)
- Last on-duty user cannot toggle off (prevents zero coverage)

**Access vs. Notification** (FR3303):
- On-duty status controls notification/responsibility ONLY
- Does NOT grant additional access rights
- Access is controlled by group membership + RLS

### No Coverage Fallback (FR3309)

**Trigger**: Inbound message arrives with NO on-duty users

**Actions**:
1. Log "no_on_duty_coverage" audit event
2. Message still routed to group inbox
3. Auto-reply may be sent (if configured)
4. Escalation scheduled (if enabled)

---

## 5. CSV IMPORTS (FR3501-FR3503)

### Import Types

1. **Users** (FR3501): Create auth users + profiles
2. **Whitelisted Numbers** (FR3502): Bulk whitelist creation
3. **Whitelist-Group Links** (FR3503): Associate numbers with groups

### Validation Rules

**All-or-nothing**: Entire file validated before any insert

**User Import**:
- Email must be valid and unique
- `role` must be: `tenant_admin`, `group_admin`, or `member`
- `full_name` required

**Whitelisted Number Import**:
- Phone must be valid E.164 format
- Optional contact creation if `contact_name` or `contact_email` provided

**Whitelist-Group Link Import**:
- Phone number must exist in `whitelisted_numbers`
- Group resolved by `group_name` or `group_id`

### Import Job Tracking

**Table**: `import_jobs`

**Fields**:
- `status`: `processing`, `completed`, `failed`, `partially_failed`
- `rows_processed` / `rows_failed`
- `error_message`: Aggregated validation errors

**Idempotency**: Upsert strategy where applicable

---

## 6. BULK SMS CAMPAIGNS

### Campaign Execution Flow

**Endpoint**: `supabase/functions/bulk-campaign`

**Process**:
1. Validate campaign status = `draft`
2. Update status to `processing`
3. Fetch active gateways
4. **Round-robin distribution**: Balance load across gateways
5. Create outbound message per recipient
6. Personalize content with `{{variable}}` placeholders
7. Track per-recipient status in `bulk_recipients`
8. Update campaign status: `completed` or `partially_failed`

### Personalization

**Template Variables**: `{{first_name}}`, `{{company}}`, etc.

**Metadata**: Stored in `bulk_recipients.metadata` (JSONB)

**Fallback**: Empty string if variable missing

### Delivery Tracking

**Per-Recipient**:
- `status`: `queued`, `sent`, `delivered`, `failed`
- `message_id`: Links to `messages` table
- `error_message`: Capture delivery failures

**Campaign-Level**:
- `sent_at`, `completed_at`
- Total success/failed counts

---

## 7. AUDIT LOG & COMPLIANCE (FR3601-FR3606)

### Logged Events

| Event Type | FR-ID | Trigger |
|------------|-------|---------|
| Group created/updated/deleted | FR3601 | Admin action |
| Group membership changed | FR3602 | Add/remove user |
| On-duty status changed | FR3603 | Toggle on/off |
| Opening hours updated | FR3604 | Schedule change |
| Auto-reply triggered/suppressed | FR3605 | Message evaluation |
| Message routed/classified/escalated | FR3606 | Routing/escalation |
| Message acknowledged | FR31002 | User action |
| Escalation event | FR31003 | Timeout reached |

### Audit Log Properties

**Immutable**: NO UPDATE or DELETE allowed

**Security**: SECURITY DEFINER function for writes

**Traceability**: All actions linked to `actor_user_id` (FR31202)

---

## 8. SIMULATION / DEMO MODE

### Scenario Structure

**Table**: `simulation_scenarios`

**Config Schema** (JSONB):
```json
{
  "name": "Meeting Invite Response",
  "events": [
    {
      "type": "inbound_message",
      "from_number": "+15551234567",
      "content": "YES confirm meeting",
      "expected_group_id": "uuid-here"
    }
  ]
}
```

### Event Types

1. **inbound_message**: Simulates FairGateway webhook
2. **outbound_message**: Creates queued message
3. **routing_test**: Dry-run routing without persistence
4. **auto_reply_test**: Evaluates auto-reply conditions

### RLS Compliance

**Critical**: Simulations MUST respect tenant isolation

**Implementation**: Service role key used internally, but RLS policies enforced

---

## 9. WEB APPLICATION REQUIREMENTS (FR31101-FR31106)

### Message Notifications (FR31101)

**Trigger**: Inbound message arrives for group where user is on-duty

**Delivery Methods**:
- In-app notification (real-time)
- Email (configurable)
- Push notification (if enabled)
- SMS (escalation only)

**RLS**: Notifications only for groups user has access to (FR31203)

### Inbox Interface (FR31102-FR31103)

**Features**:
- View messages in authorized groups (FR31102)
- Reply to messages (FR31102)
- Acknowledge messages (FR31002)
- Display group list (FR31103)
- Filter by group, status, date

### Group Status Dashboard (FR31104)

**Display per group**:
- Current on-duty users (count + names)
- Open/closed status (based on opening hours)
- Unacknowledged message count
- Last message received timestamp

### Admin Controls (FR31105)

**Group Management**:
- Toggle on-duty status (self + others if admin)
- Configure opening hours
- Manage auto-reply templates
- View/edit routing rules

### Fallback Inbox View (FR31106)

**Dedicated Interface**:
- Show messages in fallback inbox
- Manual classification UI (move to operational group)
- Classification logged (FR3706)

---

## 10. SECURITY & ACCESS CONTROL (FR31201-FR31203)

### Least-Privilege Enforcement (FR31201)

**Tenant Admin**:
- Full tenant-wide access
- Manage all groups, users, gateways
- View all messages in tenant

**Group Admin**:
- Manage assigned groups + subtree
- Manage group memberships
- Configure opening hours, auto-replies

**Member**:
- View/reply to messages in assigned groups
- Manage own on-duty status
- View group status

### Audit Traceability (FR31202)

**Requirements**:
- All admin actions logged
- All operational actions logged
- User identity captured in audit log
- System actions logged with `actor_user_id = null`

### Notification Security (FR31203)

**Implementation**:
- Notification shows "New message in [Group Name]"
- Content NOT exposed in notification
- User must open app to view content
- RLS enforced on message content access

---

## 11. EDGE FUNCTIONS SUMMARY

| Function | Purpose | FR Coverage | Idempotent |
|----------|---------|-------------|------------|
| `inbound-message` | Process incoming SMS/MMS | FR3701-FR3706 | ✅ Yes |
| `outbound-message` | Send via FairGateway | - | ✅ Yes |
| `delivery-webhook` | Track delivery status | - | ✅ Yes |
| `bulk-campaign` | Execute bulk SMS | - | ❌ No |
| `csv-import` | Validate & import data | FR3501-FR3503 | ✅ Partial |
| `simulate-scenario` | Demo mode execution | - | ✅ Yes |
| `escalate-messages` | Escalate unacknowledged | FR31001-FR31003 | ✅ Yes |
| `acknowledge-message` | Mark as acknowledged | FR31002 | ✅ Yes |

---

## 12. FUNCTIONAL REQUIREMENTS MAPPING

### Complete FR Coverage

| FR-ID Range | Category | Implementation Status |
|-------------|----------|----------------------|
| FR3101-FR3109 | Group structure | ✅ Schema + RLS |
| FR3201-FR3208 | User management | ✅ Schema + RLS |
| FR3301-FR3309 | On-duty state | ✅ Schema + Logic + RLS |
| FR3401-FR3407 | Whitelisted numbers | ✅ Schema + RLS |
| FR3501-FR3503 | CSV imports | ✅ Edge Function |
| FR3601-FR3606 | Audit logging | ✅ Schema + Triggers |
| FR3701-FR3706 | Message routing | ✅ Edge Function |
| FR3801-FR3803 | Opening hours | ✅ Schema + Logic |
| FR3901-FR3905 | Auto-replies | ✅ Schema + Logic |
| FR31001-FR31003 | Escalation | ✅ Schema + Edge Functions |
| FR31101-FR31106 | Web application | ⏳ UI Pending |
| FR31201-FR31203 | Security | ✅ RLS + Audit |

---

## 13. ERROR HANDLING & RESILIENCE

### Retry Strategy

- **Outbound Messages**: Exponential backoff (not implemented yet)
- **Webhooks**: Idempotency prevents duplicates
- **Bulk Campaigns**: Per-recipient failure isolation

### Fallback Behavior

- **Missing Gateway**: Use first active gateway
- **No Routing Match**: Use gateway fallback or tenant default
- **Auto-Reply Failure**: Log error, don't block message

### Audit Trail

- All critical actions logged
- Immutable append-only log
- Queryable by tenant admins

---

## 14. PERFORMANCE CONSIDERATIONS

### Indexing

- Composite indexes on: `tenant_id + entity_id`
- GIN indexes on: `path[]` (group hierarchy), `trigger_keywords` (auto-replies)
- Specialized indexes on: `acknowledged_at`, `escalated_at` for escalation queries

### Rate Limiting

- Bulk campaigns: 100ms delay between sends
- Auto-replies: Per-thread cooldown
- Escalation checks: Run via cron (every 5 minutes)

### Caching

- Opening hours: Cache for 5 minutes
- Routing rules: Cache for 1 minute
- Gateway config: Cache for 10 minutes

---

## Next Steps (UI Implementation)

1. Frontend components (inbox, admin panels)
2. Real-time subscriptions (new messages, on-duty changes)
3. Message acknowledgement UI
4. Fallback inbox classification interface
5. Group status dashboard
6. Notification system (email/push)
7. Reporting & analytics dashboards

---

**Document Status**: ✅ Complete for PROMPT 2 + FR Compliance
**Schema Compatibility**: ✅ Aligned with PROMPT 1 + FR Catalog
**Production Ready**: ⚠️ Backend complete, UI pending