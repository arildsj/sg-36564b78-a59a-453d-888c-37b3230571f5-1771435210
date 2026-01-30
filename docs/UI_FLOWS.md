# SeMSe + FairGateway: UI Flow Specifications

## PROMPT 2: Logical UI Workflows (Visual Design Pending)

---

## 1. AUTHENTICATION & SESSION

### Login Flow
1. User enters email + password
2. Supabase Auth validates credentials
3. Session established with JWT
4. Helper functions extract `user_tenant_id()` and `user_role()`
5. Redirect to appropriate dashboard based on role

### Role-Based Landing
- **Tenant Admin**: Admin Dashboard
- **Group Admin**: Group Management
- **Member**: Inbox (default operational group)

---

## 2. ADMIN DASHBOARD (TENANT ADMIN)

### Sections

#### A) Tenant Settings
- Edit tenant name, timezone, default fallback group
- Manage tenant-level configurations

#### B) User Management
- **List**: All users in tenant (table view)
- **Create**: Email, full_name, role (tenant_admin | group_admin | member)
- **Edit**: Update role, toggle is_active
- **Delete**: Soft delete (sets deleted_at)
- **CSV Import**: Upload users.csv → validate → bulk create

#### C) Group Management
- **Tree View**: Hierarchical display with indentation
- **Create**: Name, parent_group_id, group_kind (structural | operational)
- **Edit**: Name, parent (with validation: no circular references)
- **Delete**: Soft delete (cascade to children or prevent if has messages)
- **Assign Members**: Add/remove users to groups

#### D) Gateway Configuration
- **List**: All gateways (provider, status, from_number)
- **Create**: Provider name, API key, endpoint, from_number
- **Edit**: Update credentials, toggle is_active
- **Fallback Inbox**: Set operational_group_id per gateway

#### E) Whitelist Management
- **List**: All whitelisted numbers (phone, contact, linked groups)
- **Create**: Phone number (E.164), optional contact
- **Link to Groups**: Multi-select groups per number
- **CSV Import**: Upload whitelist.csv → validate → bulk create

#### F) Routing Rules
- **List**: All rules (group, priority, type, pattern)
- **Create**: Group, rule_type (prefix | keyword | exact), pattern, priority
- **Edit**: Update pattern, adjust priority
- **Reorder**: Drag-and-drop priority adjustment
- **Delete**: Soft delete

#### G) Audit Log Viewer
- **Filters**: Date range, action_type, entity_type, user
- **Table**: Timestamp, actor, action, entity, metadata
- **Export**: CSV download

---

## 3. GROUP ADMIN DASHBOARD

### Scope
- **Subtree Access**: Can manage own group + all descendants
- **No Cross-Group**: Cannot view/edit sibling or parent groups

### Features

#### A) Group Settings
- Edit group name, description
- View hierarchy (read-only for ancestors)

#### B) Member Management
- Add/remove members to managed groups
- View member list with roles

#### C) Opening Hours
- **Weekly Schedule**: Set open/close times per day (HH:MM)
- **Exceptions**: Add date-specific overrides (holiday closures, etc.)
- **Timezone**: Display in group's configured timezone

#### D) Auto-Replies
- **List**: All auto-replies for operational groups in subtree
- **Create**: Trigger type, keywords, response template, cooldown
- **Priority**: Adjust priority (first match wins)
- **Test**: Simulate auto-reply evaluation

#### E) Routing Rules (Group-Scoped)
- Manage routing rules for operational groups in subtree
- Same CRUD as tenant admin, but scoped

---

## 4. INBOX VIEW (ALL ROLES)

### Sidebar: Group List
- **Operational Groups Only**: Display groups where user is a member
- **Unread Count**: Badge showing unread messages per group
- **Fallback Inbox**: Special entry for unknown senders (if applicable)

### Main Panel: Message Thread List
- **List**: All threads for selected group
- **Columns**: Contact name/phone, last message preview, timestamp, unread indicator
- **Sort**: Most recent first
- **Filter**: Unread only, date range

### Thread View
- **Header**: Contact name, phone, thread metadata
- **Messages**: Chronological order (oldest first)
- **Visual Distinction**: Inbound (left), Outbound (right), Auto-reply (highlighted)
- **Reply Box**: Compose new message (textarea + send button)
- **Send Action**: Creates outbound message → triggers `outbound-message` function

### On-Duty Toggle
- **Per-Group**: Toggle on-duty status for current user in selected group
- **Validation**: Cannot toggle off if last on-duty user (show warning)
- **Visual Indicator**: Badge showing on-duty status

### Contact Quick Actions
- **Add to Whitelist**: If inbound from unknown number
- **Link to Group**: Associate contact with additional groups
- **View Contact Details**: Full contact profile

---

## 5. BULK CAMPAIGNS

### Campaign Creation Workflow

#### Step 1: Basic Info
- Campaign name, description
- Select sending group (operational)
- Compose message template with {{variables}}

#### Step 2: Recipients
- **Manual Entry**: Add phone numbers one-by-one
- **CSV Upload**: Upload recipients.csv (phone_number, metadata columns)
- **From Contacts**: Select from existing contacts
- **From Group**: All contacts linked to a group

#### Step 3: Preview
- Show recipient count
- Display personalized preview for first 5 recipients
- Validate all phone numbers

#### Step 4: Send
- Create campaign record (status = draft)
- Trigger `bulk-campaign` function
- Redirect to campaign tracking page

### Campaign Tracking
- **List**: All campaigns (name, status, sent_at, success/failed counts)
- **Details**: Per-recipient status table (phone, status, error)
- **Retry Failed**: Requeue failed recipients

---

## 6. SIMULATION / DEMO MODE

### Scenario Management

#### List View
- **Predefined Scenarios**: System-provided seeds
- **Custom Scenarios**: User-created (tenant admin only)

#### Create Scenario
- Name, description
- Event builder:
  - Add inbound/outbound message events
  - Configure expected routing outcome
  - Set auto-reply expectations

#### Execute Scenario
- Click "Run Simulation"
- Progress indicator during execution
- Results panel:
  - ✅ Expected outcome matched
  - ❌ Unexpected routing or behavior
  - Event-by-event breakdown

### Use Cases
- **Onboarding**: Help new users understand routing
- **Testing**: Validate routing rules before production
- **Demos**: Show platform capabilities to prospects

---

## 7. CONTACT MANAGEMENT

### Contact List
- **Table View**: Name, email, phone numbers, linked groups
- **Search**: By name, email, phone
- **Filter**: By group

### Contact Details
- **Profile**: Full name, email, notes
- **Phone Numbers**: Multiple phones per contact (E.164)
- **Group Links**: Display all groups contact is associated with
- **Message History**: Link to threads with this contact

### Create/Edit Contact
- Form: Full name, email, notes
- Add phone numbers (validated E.164)
- Select groups to link

---

## 8. REPORTS & ANALYTICS (FUTURE)

### Dashboard Widgets
- Message volume (inbound/outbound) over time
- On-duty coverage percentage
- Auto-reply effectiveness
- Escalation events count
- Bulk campaign success rates

### Filters
- Date range, group, user, gateway

---

## 9. SETTINGS & PREFERENCES

### User Profile
- Update full name, email
- Change password
- Notification preferences (email, SMS)

### Tenant Settings (Admin Only)
- Tenant name, timezone
- Default fallback group
- Billing information (future)

---

## 10. NAVIGATION STRUCTURE

### Top-Level Menu

**Tenant Admin**:
- Dashboard
- Inbox
- Bulk Campaigns
- Contacts
- Admin Panel
  - Users
  - Groups
  - Gateways
  - Whitelists
  - Routing Rules
  - Audit Log
- Simulation
- Settings

**Group Admin**:
- Inbox
- Bulk Campaigns
- Contacts
- Group Management
  - Members
  - Opening Hours
  - Auto-Replies
  - Routing Rules
- Simulation
- Settings

**Member**:
- Inbox
- Contacts
- Settings

---

## 11. REAL-TIME FEATURES (PENDING)

### Supabase Realtime Subscriptions

**Inbox Updates**:
- Subscribe to `messages` table filtered by `resolved_group_id`
- New message → update thread list, increment unread count
- Auto-scroll to bottom on new message in open thread

**On-Duty Status**:
- Subscribe to `on_duty_state` table
- Show real-time on-duty indicator for group members

**Delivery Status**:
- Subscribe to `delivery_status_events` table
- Update message status in real-time (sent → delivered)

---

## 12. ERROR STATES & FEEDBACK

### User Feedback Patterns
- **Success**: Toast notification (green)
- **Error**: Toast with error message (red)
- **Loading**: Spinner or skeleton UI
- **Empty States**: Helpful onboarding messages

### Validation
- Client-side validation (immediate feedback)
- Server-side validation (authoritative)
- Display errors inline near form fields

---

## 13. ACCESSIBILITY & UX

### Requirements
- **Keyboard Navigation**: All actions accessible via keyboard
- **Screen Reader**: Proper ARIA labels
- **Color Contrast**: WCAG AA compliance
- **Mobile Responsive**: All views work on mobile (priority: inbox)

### Performance
- Pagination for large lists (50 items per page)
- Infinite scroll for message threads
- Optimistic UI updates (instant feedback)

---

## 14. FUNCTIONAL REQUIREMENTS MAPPING (UI)

| FR-ID | UI Component | Location |
|-------|--------------|----------|
| FR-101 | User management | Admin Panel → Users |
| FR-102 | Group hierarchy | Admin Panel → Groups |
| FR-103 | Inbox view | Inbox → Thread List |
| FR-104 | Compose message | Inbox → Reply Box |
| FR-105 | On-duty toggle | Inbox → Sidebar |
| FR-106 | Opening hours | Group Admin → Opening Hours |
| FR-107 | Auto-replies | Group Admin → Auto-Replies |
| FR-108 | Routing rules | Admin Panel → Routing Rules |
| FR-109 | Whitelist | Admin Panel → Whitelists |
| FR-110 | Bulk campaigns | Bulk Campaigns → Create |
| FR-111 | CSV import | Admin Panel → Users/Whitelists |
| FR-112 | Simulation | Simulation → Scenario List |
| FR-113 | Contact management | Contacts → List/Details |
| FR-114 | Audit log | Admin Panel → Audit Log |

---

**Document Status**: ✅ Complete for PROMPT 2
**Implementation Status**: ⚠️ Logical flows defined, UI components pending
**Next Step**: Build React components with Next.js Pages Router

---

## Notes for UI Implementation

1. **State Management**: Use React Context for user session, selected group
2. **Data Fetching**: Direct Supabase client queries with RLS enforcement
3. **Forms**: React Hook Form + Zod validation
4. **Tables**: Shadcn/UI Table component with sorting/filtering
5. **Real-time**: Supabase Realtime channels for inbox updates

**No backend service calls required** — all logic is in Edge Functions + RLS policies.