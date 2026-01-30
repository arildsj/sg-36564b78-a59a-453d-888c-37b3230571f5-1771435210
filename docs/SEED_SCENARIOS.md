# SeMSe + FairGateway: Seed Simulation Scenarios

## PROMPT 2: Predefined Demo Scenarios

---

## Scenario 1: Known Sender → Correct Group Routing

**Name**: "Known Customer - Support Inquiry"

**Description**: Whitelisted customer sends message to support group via keyword routing.

**Setup**:
- Whitelisted number: `+15551234567` (John Doe)
- Linked to groups: Support, Sales
- Routing rule: keyword "help" → Support group (priority 100)

**Events**:
```json
[
  {
    "type": "inbound_message",
    "from_number": "+15551234567",
    "content": "I need help with my account",
    "expected_outcome": {
      "resolved_group": "Support",
      "routing_rule_matched": true,
      "is_fallback": false
    }
  }
]
```

**Expected Result**:
- ✅ Message routed to Support group
- ✅ Thread created for John Doe
- ✅ On-duty users notified

---

## Scenario 2: Unknown Sender → Fallback Inbox

**Name**: "Unknown Sender - Fallback Routing"

**Description**: Message from unrecognized number routes to gateway fallback inbox.

**Setup**:
- From number: `+15559876543` (not whitelisted)
- Gateway fallback inbox: configured to "Unassigned" group

**Events**:
```json
[
  {
    "type": "inbound_message",
    "from_number": "+15559876543",
    "content": "Hello, I have a question",
    "expected_outcome": {
      "resolved_group": "Unassigned",
      "is_fallback": true
    }
  }
]
```

**Expected Result**:
- ✅ Message routed to fallback inbox
- ✅ Thread created for unknown contact
- ✅ Admin can manually whitelist and reassign

---

## Scenario 3: Keyword Routing - Meeting Confirmation

**Name**: "Meeting Confirmation - YES/NO Response"

**Description**: Customer responds to meeting invite with keyword.

**Setup**:
- Whitelisted number: `+15551112222` (Jane Smith)
- Routing rules:
  - keyword "YES" → Appointments group (priority 90)
  - keyword "NO" → Appointments group (priority 89)

**Events**:
```json
[
  {
    "type": "inbound_message",
    "from_number": "+15551112222",
    "content": "YES confirm my appointment",
    "expected_outcome": {
      "resolved_group": "Appointments",
      "routing_rule_matched": true,
      "keyword": "YES"
    }
  },
  {
    "type": "routing_test",
    "from_number": "+15551112222",
    "content": "NO I need to reschedule",
    "expected_outcome": {
      "keyword": "NO"
    }
  }
]
```

**Expected Result**:
- ✅ Both messages route to Appointments group
- ✅ Routing rule priority determines match

---

## Scenario 4: Auto-Reply Outside Hours

**Name**: "After-Hours Auto-Reply"

**Description**: Message received outside opening hours triggers auto-reply.

**Setup**:
- Group: Support
- Opening hours: Mon-Fri, 9:00-17:00
- Auto-reply: trigger_type = "outside_hours", response = "We're closed. We'll respond during business hours."

**Events**:
```json
[
  {
    "type": "inbound_message",
    "from_number": "+15551234567",
    "content": "Need help urgently",
    "simulated_time": "2026-01-30T22:00:00Z",
    "expected_outcome": {
      "auto_reply_sent": true,
      "auto_reply_content": "We're closed. We'll respond during business hours."
    }
  }
]
```

**Expected Result**:
- ✅ Auto-reply sent immediately
- ✅ Message still routed to Support group
- ✅ Cooldown timer started

---

## Scenario 5: Escalation - No On-Duty Coverage

**Name**: "No Coverage Escalation"

**Description**: Message arrives when no users are on-duty, escalates to admin.

**Setup**:
- Group: Support
- All members: is_on_duty = false
- Tenant admin: admin@example.com

**Events**:
```json
[
  {
    "type": "inbound_message",
    "from_number": "+15551234567",
    "content": "Urgent support needed",
    "expected_outcome": {
      "escalation_triggered": true,
      "escalated_to": ["tenant_admin"]
    }
  }
]
```

**Expected Result**:
- ✅ Message routed correctly
- ✅ Escalation event logged
- ✅ Tenant admin notified

---

## Scenario 6: Thread Continuity - Reply Returns

**Name**: "Reply Returns to Originating Group"

**Description**: Customer replies to previous conversation, message routes back to same group.

**Setup**:
- Existing thread: Contact +15551234567 ↔ Sales group
- Thread last_message_at: yesterday

**Events**:
```json
[
  {
    "type": "inbound_message",
    "from_number": "+15551234567",
    "content": "Thanks for your help yesterday",
    "expected_outcome": {
      "thread_id": "existing-thread-uuid",
      "resolved_group": "Sales",
      "routing_rule_applied": false
    }
  }
]
```

**Expected Result**:
- ✅ Message added to existing thread
- ✅ Routing rules bypassed (thread takes precedence)
- ✅ Sales group receives message

---

## Scenario 7: Bulk Campaign Execution

**Name**: "Promotional SMS Campaign"

**Description**: Send bulk SMS with personalization to 100 recipients.

**Setup**:
- Campaign: "Spring Sale"
- Template: "Hi {{first_name}}, enjoy 20% off this week!"
- Recipients: 100 contacts with metadata: {first_name: "..."}

**Events**:
```json
[
  {
    "type": "bulk_campaign_test",
    "campaign_id": "test-campaign-uuid",
    "expected_outcome": {
      "total_recipients": 100,
      "messages_queued": 100,
      "personalization_applied": true
    }
  }
]
```

**Expected Result**:
- ✅ 100 outbound messages created
- ✅ Each message personalized correctly
- ✅ Round-robin gateway distribution

---

## Scenario 8: Prefix Routing - Department Codes

**Name**: "Department Code Routing"

**Description**: Messages starting with department codes route to specific groups.

**Setup**:
- Routing rules:
  - prefix "SALES:" → Sales group (priority 100)
  - prefix "SUPPORT:" → Support group (priority 100)
  - prefix "BILLING:" → Billing group (priority 100)

**Events**:
```json
[
  {
    "type": "inbound_message",
    "from_number": "+15551234567",
    "content": "SALES: I want a quote",
    "expected_outcome": {
      "resolved_group": "Sales",
      "routing_rule_matched": true
    }
  },
  {
    "type": "inbound_message",
    "from_number": "+15551234567",
    "content": "SUPPORT: Login issue",
    "expected_outcome": {
      "resolved_group": "Support"
    }
  }
]
```

**Expected Result**:
- ✅ Each message routes to correct department
- ✅ Prefix matching works case-insensitive

---

## Scenario 9: CSV Import Validation

**Name**: "Bulk User Import with Validation"

**Description**: Upload CSV with users, validate all rows before committing.

**Setup**:
- CSV contains: 10 valid rows, 2 invalid rows (bad email)

**Events**:
```json
[
  {
    "type": "csv_import_test",
    "import_type": "users",
    "csv_content": "email,full_name,role\nuser1@test.com,User One,member\ninvalid-email,User Two,member",
    "expected_outcome": {
      "validation_failed": true,
      "errors": ["Line 3: Invalid email"],
      "rows_imported": 0
    }
  }
]
```

**Expected Result**:
- ✅ Validation detects errors
- ✅ No partial imports
- ✅ Clear error messages

---

## Scenario 10: Multi-Gateway Load Balancing

**Name**: "Round-Robin Gateway Distribution"

**Description**: Bulk campaign distributes messages across multiple gateways.

**Setup**:
- 3 active gateways: Gateway A, B, C
- 9 recipients

**Events**:
```json
[
  {
    "type": "bulk_campaign_test",
    "campaign_id": "multi-gateway-campaign",
    "expected_outcome": {
      "gateway_distribution": {
        "Gateway A": 3,
        "Gateway B": 3,
        "Gateway C": 3
      }
    }
  }
]
```

**Expected Result**:
- ✅ Even distribution across gateways
- ✅ Load balancing effective

---

## Implementation Notes

### Seed Data Required

1. **Tenants**: Demo tenant "Acme Corp"
2. **Users**:
   - admin@acme.com (tenant_admin)
   - support@acme.com (member)
   - sales@acme.com (member)
3. **Groups**:
   - Support (operational)
   - Sales (operational)
   - Appointments (operational)
   - Unassigned (operational, fallback)
4. **Gateways**: 2 test gateways (FairGateway test endpoints)
5. **Whitelisted Numbers**: 5 test contacts
6. **Routing Rules**: As described in scenarios
7. **Auto-Replies**: 2 rules (outside hours, keyword)

### Execution

Scenarios stored in `simulation_scenarios` table:
```sql
INSERT INTO simulation_scenarios (tenant_id, name, description, simulation_config)
VALUES (
  'tenant-uuid',
  'Known Sender → Correct Group Routing',
  'Whitelisted customer sends message to support group',
  '{"events": [...]}'::jsonb
);
```

### UI Integration

- Scenario picker dropdown in Simulation UI
- "Run Scenario" button triggers `simulate-scenario` Edge Function
- Results displayed in expandable panels with pass/fail indicators

---

**Document Status**: ✅ Complete for PROMPT 2
**Seed Data**: ⚠️ SQL inserts pending
**Integration**: ⚠️ UI components pending