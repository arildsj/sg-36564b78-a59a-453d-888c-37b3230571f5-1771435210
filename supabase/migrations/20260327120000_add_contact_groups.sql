-- Contact groups under SeMSe groups
create table if not exists public.contact_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id, name)
);

create table if not exists public.contact_group_members (
  contact_group_id uuid not null references public.contact_groups(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_group_id, contact_id)
);

alter table public.contact_groups enable row level security;
alter table public.contact_group_members enable row level security;

drop policy if exists "Users can read contact groups in own tenant" on public.contact_groups;
create policy "Users can read contact groups in own tenant"
on public.contact_groups
for select
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.tenant_id = contact_groups.tenant_id
  )
);

drop policy if exists "Users can manage contact groups in own tenant" on public.contact_groups;
create policy "Users can manage contact groups in own tenant"
on public.contact_groups
for all
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.tenant_id = contact_groups.tenant_id
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.tenant_id = contact_groups.tenant_id
  )
);

drop policy if exists "Users can read contact group memberships in own tenant" on public.contact_group_members;
create policy "Users can read contact group memberships in own tenant"
on public.contact_group_members
for select
using (
  exists (
    select 1
    from public.contact_groups cg
    join public.user_profiles up on up.tenant_id = cg.tenant_id
    where up.id = auth.uid()
      and cg.id = contact_group_members.contact_group_id
  )
);

drop policy if exists "Users can manage contact group memberships in own tenant" on public.contact_group_members;
create policy "Users can manage contact group memberships in own tenant"
on public.contact_group_members
for all
using (
  exists (
    select 1
    from public.contact_groups cg
    join public.user_profiles up on up.tenant_id = cg.tenant_id
    where up.id = auth.uid()
      and cg.id = contact_group_members.contact_group_id
  )
)
with check (
  exists (
    select 1
    from public.contact_groups cg
    join public.user_profiles up on up.tenant_id = cg.tenant_id
    where up.id = auth.uid()
      and cg.id = contact_group_members.contact_group_id
  )
);
