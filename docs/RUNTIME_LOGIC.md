# SeMSe + FairGateway: Runtime Logic Specification

## PROMPT 2 Implementation: Deterministic Workflows

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
   - **Known**: Whitelisted number → resolve candidate groups
   - **Unknown**: Route to fallback inbox
6. **Routing Rule Evaluation**: Apply rules by priority (descending)
7. **Thread Creation**: Deterministic thread binding
8. **Message Persistence**: Create message record
9. **Auto-Reply Evaluation**: Check conditions and cooldown
10. **Coverage Check**: Escalate if no on-duty users

### Routing Rule Types

| Rule Type | Matching Logic | Example |
|-----------|----------------|---------|
| `prefix` | `content.startsWith(pattern)` | "HELP" matches "HELP me" |
| `keyword` | Word boundary match `\b{pattern}\b` | "appointment" matches "need appointment" |
| `exact` | Exact string match | "YES" only matches "YES" |

**Priority**: Integer field, descending order (highest priority first)

**First Match Wins**: Evaluation stops at first matching rule

### Thread Binding

**Rule**: Replies MUST return to originating operational group

**Implementation**: Thread key = `tenant_id + contact_phone + resolved_group_id`

**Guarantee**: Same contact + group = same thread

---

## 2. OPENING HOURS & AUTO-REPLIES

### Opening Hours Evaluation

**Timezone-Aware**: All times evaluated in group's configured timezone

**Priority**:
1. Date exceptions (highest)
2. Weekly schedule
3. Default to closed if no schedule

**Function**: `checkOpeningHours(groupId)` → boolean

### Auto-Reply Conditions

**Trigger Types**:
- `outside_hours`: Send only when group is closed
- `keyword`: Match trigger_keywords (case-insensitive, partial match)
- `first_message`: Send on thread creation (not implemented yet)

**Cooldown**: Per-thread cooldown prevents spam (configurable minutes)

**Execution**:
- Only sent if NO on-duty users available
- Logged with `is_auto_reply = true`
- Linked to triggering message via `triggered_by_message_id`

**Priority**: First matching auto-reply wins

---

## 3. ON-DUTY COVERAGE & ESCALATION

### On-Duty State

**Scope**: Per user, per operational group

**Rules**:
- Only on-duty users receive message notifications
- Minimum on-duty count enforced (prevent all-off scenario)
- Last on-duty user cannot toggle off

### Escalation Logic

**Trigger**: Message arrives with NO on-duty users in resolved group

**Action**:
1. Identify tenant admins
2. Log audit event: `escalation_no_coverage`
3. Notify admins (implementation pending)

**Determinism**: Always escalate, never drop messages

---

## 4. CSV IMPORTS

### Import Types

1. **Users**: Create auth users + profiles
2. **Whitelisted Numbers**: Bulk whitelist creation
3. **Whitelist-Group Links**: Associate numbers with groups

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

## 5. BULK SMS CAMPAIGNS

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

## 6. SIMULATION / DEMO MODE

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

### Seed Scenarios

**Required Scenarios**:
1. Known sender → correct operational group
2. Unknown sender → fallback inbox
3. Keyword routing (e.g., "HELP" → support group)
4. Auto-reply outside hours
5. Escalation (no on-duty coverage)

---

## 7. EDGE FUNCTIONS SUMMARY

| Function | Purpose | Idempotent |
|----------|---------|------------|
| `inbound-message` | Process incoming SMS/MMS | ✅ Yes |
| `outbound-message` | Send via FairGateway | ✅ Yes |
| `delivery-webhook` | Track delivery status | ✅ Yes |
| `bulk-campaign` | Execute bulk SMS | ❌ No |
| `csv-import` | Validate & import data | ✅ Partial |
| `simulate-scenario` | Demo mode execution | ✅ Yes |

---

## 8. FUNCTIONAL REQUIREMENTS MAPPING

### FR Coverage (PROMPT 2)

| FR-ID | Requirement | Implementation |
|-------|-------------|----------------|
| FR-001 | Tenant isolation | RLS + tenant_id checks |
| FR-002 | Hierarchical groups | Materialized path queries |
| FR-003 | Message routing | `inbound-message` function |
| FR-004 | Thread continuity | Thread key determinism |
| FR-005 | Opening hours | Timezone-aware evaluation |
| FR-006 | Auto-replies | Condition + cooldown logic |
| FR-007 | On-duty state | Per-user-group state |
| FR-008 | Escalation | Tenant admin notification |
| FR-009 | Bulk campaigns | Round-robin distribution |
| FR-010 | CSV imports | All-or-nothing validation |
| FR-011 | Simulation mode | RLS-compliant scenarios |
| FR-012 | Audit logging | Automatic triggers |

---

## 9. ERROR HANDLING & RESILIENCE

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

## 10. PERFORMANCE CONSIDERATIONS

### Indexing

- Composite indexes on: `tenant_id + entity_id`
- GIN indexes on: `path[]` (group hierarchy), `trigger_keywords` (auto-replies)

### Rate Limiting

- Bulk campaigns: 100ms delay between sends
- Auto-replies: Per-thread cooldown

### Caching

- Opening hours: Cache for 5 minutes
- Routing rules: Cache for 1 minute
- Gateway config: Cache for 10 minutes

---

## Next Steps (Awaiting PROMPT 3 - UI Implementation)

1. Frontend components (inbox, admin panels)
2. Real-time subscriptions (new messages)
3. FairGateway API integration
4. Notification system (email/push)
5. Reporting & analytics dashboards

---

**Document Status**: ✅ Complete for PROMPT 2
**Schema Compatibility**: ✅ Aligned with PROMPT 1
**Production Ready**: ⚠️ Edge Functions tested, UI pending