# SeMSe 2.0 + FairGateway

**Multi-Tenant B2B SMS/MMS Platform**

## Overview

SeMSe 2.0 is a production-ready, multi-tenant web application for enterprise SMS/MMS management, integrated with FairGateway for reliable message delivery. This system provides hierarchical group management, intelligent message routing, automated responses, bulk campaigns, and comprehensive audit trails.

## Technology Stack

- **Backend**: Supabase (PostgreSQL 15+)
- **Authentication**: Supabase Auth
- **Security**: Row Level Security (RLS)
- **API**: PostgREST (auto-generated REST API)
- **Integration**: FairGateway SMS/MMS API

## Schema Implementation

### Migrations

1. **001_initial_schema.sql**: Core tables, constraints, indexes
2. **002_rls_policies.sql**: Row Level Security policies
3. **003_audit_functions.sql**: Audit logging infrastructure
4. **004_helper_functions.sql**: Business logic utilities

### Key Features

- **Multi-Tenancy**: Complete tenant isolation via RLS
- **Hierarchical Groups**: Unlimited depth with materialized paths
- **Message Threading**: Conversation continuity guaranteed
- **Dynamic Routing**: Priority-based rule engine
- **Auto-Replies**: Keyword, time-based, first-message triggers
- **Bulk Campaigns**: Per-recipient tracking with delivery status
- **Audit Trail**: Append-only logging of all critical actions
- **Soft Deletes**: Preserves referential integrity and audit history

## Access Model

### Roles

- **Tenant Admin**: Full tenant scope
- **Group Admin**: Subtree scope (optional)
- **Member**: Group membership scope

### On-Duty State

- Per-user, per-operational-group availability flag
- Not a permission level, just visibility state

## Database Schema Highlights

### Core Tables

- `tenants`: Root isolation boundary
- `user_profiles`: Internal actors (→ auth.users)
- `groups`: Hierarchical organizational structure
- `contacts`: External parties (never users)
- `gateways`: FairGateway instances
- `messages`: SMS/MMS records with threading
- `routing_rules`: Dynamic message routing
- `auto_replies`: Automated response templates
- `bulk_campaigns`: Mass messaging with tracking
- `audit_log`: Append-only compliance trail

### Constraints

- **E.164 Phone Format**: Enforced via CHECK constraints
- **Tenant Isolation**: All queries filtered by tenant_id
- **Idempotency**: Unique constraint on message sends
- **Primary Phones**: One per contact (trigger-enforced)

## Security

### Row Level Security (RLS)

- Enabled on all tenant-scoped tables
- Policies enforce tenant boundaries
- No permissive rules for convenience
- Helper functions for access checks

### Audit Logging

- All critical operations logged automatically
- SECURITY DEFINER functions for safe writes
- No UPDATE/DELETE allowed on audit_log
- Tenant admins can view full audit trail

## Documentation

- **ERD.md**: Complete entity relationship diagram
- **FR_MAPPING.md**: Schema-to-requirements traceability
- **This README**: System overview

## Setup Instructions

### Prerequisites

- Supabase project with PostgreSQL 15+
- Database access (direct connection or Supabase CLI)

### Migration Steps

```bash
# Using Supabase CLI
supabase db reset  # Reset if needed
supabase db push   # Apply migrations

# Or run migrations manually in order
psql -f supabase/migrations/001_initial_schema.sql
psql -f supabase/migrations/002_rls_policies.sql
psql -f supabase/migrations/003_audit_functions.sql
psql -f supabase/migrations/004_helper_functions.sql
```

### Verification

```sql
-- Check table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verify RLS enabled
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- Test helper functions
SELECT * FROM get_user_accessible_groups(auth.uid());
```

## Next Steps (PROMPT 2)

The following will be implemented in PROMPT 2:

- Runtime message routing logic
- FairGateway webhook handlers
- Auto-reply evaluation engine
- Bulk campaign execution
- Business hours logic
- UI workflows and components
- API integration layers

## Project Status

**PROMPT 1: COMPLETE**

- ✅ Complete schema design
- ✅ Row Level Security policies
- ✅ Audit logging infrastructure
- ✅ Helper functions for business logic
- ✅ E.164 phone validation
- ✅ Soft delete patterns
- ✅ Documentation (ERD, FR mapping)

**PROMPT 2: PENDING**

Runtime logic, workflows, and UI implementation awaiting requirements.

---

© 2026 SeMSe 2.0 | Built on Supabase