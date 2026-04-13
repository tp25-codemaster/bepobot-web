-- BepoBot Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  onboarding_complete boolean default false,
  plan text default 'trial' check (plan in ('trial', 'starter', 'pro', 'business')),
  evisitor_username text,
  evisitor_password text,
  evisitor_connected boolean default false,
  evisitor_auto_checkin boolean default false,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Messages (chat history)
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('user', 'bot')),
  content text not null,
  type text default 'text' check (type in ('text', 'card', 'quick_actions')),
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_messages_user_id on public.messages (user_id, created_at desc);

-- 3. Apartments
create table public.apartments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  wifi_ssid text,
  wifi_password text,
  parking text,
  rules text,
  checkin_instructions text,
  created_at timestamptz default now()
);

create index idx_apartments_user_id on public.apartments (user_id);

-- 4. Contacts (cleaners, co-hosts)
create table public.contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  role text not null check (role in ('cleaner', 'cohost', 'maintenance')),
  phone text,
  email text,
  created_at timestamptz default now()
);

create index idx_contacts_user_id on public.contacts (user_id);

-- 5. eVisitor log
create table public.evisitor_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  action text not null check (action in ('checkin', 'checkout', 'cancel')),
  guest_name text not null,
  apartment_name text not null,
  evisitor_id text,
  status text not null check (status in ('success', 'error')),
  error_message text,
  created_at timestamptz default now()
);

create index idx_evisitor_log_user_id on public.evisitor_log (user_id, created_at desc);

-- 6. Waitlist (landing page signups)
create table public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  apartments text not null,
  location text,
  created_at timestamptz default now()
);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.apartments enable row level security;
alter table public.contacts enable row level security;
alter table public.evisitor_log enable row level security;
alter table public.waitlist enable row level security;

-- Profiles: users can read/update only their own
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Messages: users can CRUD only their own
create policy "Users can view own messages"
  on public.messages for select using (auth.uid() = user_id);
create policy "Users can insert own messages"
  on public.messages for insert with check (auth.uid() = user_id);

-- Apartments: users can CRUD only their own
create policy "Users can view own apartments"
  on public.apartments for select using (auth.uid() = user_id);
create policy "Users can insert own apartments"
  on public.apartments for insert with check (auth.uid() = user_id);
create policy "Users can update own apartments"
  on public.apartments for update using (auth.uid() = user_id);
create policy "Users can delete own apartments"
  on public.apartments for delete using (auth.uid() = user_id);

-- Contacts: users can CRUD only their own
create policy "Users can view own contacts"
  on public.contacts for select using (auth.uid() = user_id);
create policy "Users can insert own contacts"
  on public.contacts for insert with check (auth.uid() = user_id);
create policy "Users can update own contacts"
  on public.contacts for update using (auth.uid() = user_id);
create policy "Users can delete own contacts"
  on public.contacts for delete using (auth.uid() = user_id);

-- eVisitor log: users can read only their own
create policy "Users can view own evisitor log"
  on public.evisitor_log for select using (auth.uid() = user_id);
create policy "Users can insert own evisitor log"
  on public.evisitor_log for insert with check (auth.uid() = user_id);

-- Waitlist: anyone can insert (public form), no read
create policy "Anyone can join waitlist"
  on public.waitlist for insert with check (true);
