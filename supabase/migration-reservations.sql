-- Reservations table
create table public.reservations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  apartment_id uuid references public.apartments on delete cascade not null,
  guest_name text not null,
  guest_contact text,
  guests_count integer default 1,
  check_in date not null,
  check_out date not null,
  status text default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz default now()
);

create index idx_reservations_user_id on public.reservations (user_id, check_in);
create index idx_reservations_apartment on public.reservations (apartment_id, check_in);

-- RLS
alter table public.reservations enable row level security;

create policy "Users can view own reservations"
  on public.reservations for select using (auth.uid() = user_id);
create policy "Users can insert own reservations"
  on public.reservations for insert with check (auth.uid() = user_id);
create policy "Users can update own reservations"
  on public.reservations for update using (auth.uid() = user_id);
create policy "Users can delete own reservations"
  on public.reservations for delete using (auth.uid() = user_id);
