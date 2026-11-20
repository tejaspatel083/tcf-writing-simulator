-- ===================================================
-- TCF ÉCRITURE SIMULATOR - SUPABASE SCHEMA & RLS
-- ===================================================

-- 1. Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create submissions table
create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email text,
  year text not null,
  month text not null,
  combination integer not null,
  started_at timestamp with time zone not null,
  completed_at timestamp with time zone not null,
  duration_seconds integer not null,
  task1_answer text default '' not null,
  task1_word_count integer default 0 not null,
  task2_answer text default '' not null,
  task2_word_count integer default 0 not null,
  task3_answer text default '' not null,
  task3_word_count integer default 0 not null,
  ai_feedback jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure columns exist if table was already created
alter table public.submissions add column if not exists email text;
alter table public.submissions add column if not exists ai_feedback jsonb;

-- 3. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;

-- 4. RLS Policies for Profiles
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admin can read all profiles" on public.profiles;
drop policy if exists "Users and Admin can read profiles" on public.profiles;
drop policy if exists "Allow anon read profiles" on public.profiles;

create policy "Users and Admin can read profiles" on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or (auth.jwt() ->> 'email') = 'tejas083patel@gmail.com'
  );

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- 5. RLS Policies for Submissions (CRITICAL SECURITY REQUIREMENT)
-- Users can read their own submissions, Admin can read ALL submissions.
drop policy if exists "Users can read own submissions" on public.submissions;
drop policy if exists "Admin can read all submissions" on public.submissions;
drop policy if exists "Users and Admin can read submissions" on public.submissions;

create policy "Users and Admin can read submissions" on public.submissions
  for select to authenticated
  using (
    auth.uid() = user_id
    or (auth.jwt() ->> 'email') = 'tejas083patel@gmail.com'
  );

create policy "Users can insert own submissions" on public.submissions
  for insert with check (auth.uid() = user_id);

-- Allow users to update their own submissions (e.g. saving AI score and feedback),
-- and allow Admin (tejas083patel@gmail.com) to update any submission
drop policy if exists "Users and Admin can update submissions" on public.submissions;

create policy "Users and Admin can update submissions" on public.submissions
  for update to authenticated
  using (
    auth.uid() = user_id
    or (auth.jwt() ->> 'email') = 'tejas083patel@gmail.com'
  )
  with check (
    auth.uid() = user_id
    or (auth.jwt() ->> 'email') = 'tejas083patel@gmail.com'
  );

drop policy if exists "Users can delete own submissions" on public.submissions;
drop policy if exists "Users and Admin can delete submissions" on public.submissions;

create policy "Users and Admin can delete submissions" on public.submissions
  for delete to authenticated
  using (
    auth.uid() = user_id
    or (auth.jwt() ->> 'email') = 'tejas083patel@gmail.com'
  );

-- 6. Trigger to automatically create a profile entry when a new user registers
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Explicit Table Grants (Required by Supabase)
-- Ensure anonymous unauthenticated users have NO access to read profiles or submissions
revoke all on public.profiles from anon;
revoke all on public.submissions from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select, insert, update, delete on public.submissions to authenticated;
grant all on public.submissions to service_role;

