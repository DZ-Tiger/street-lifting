-- 1. Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 2. Create Profiles Table
create table public.profiles (
  user_id uuid references auth.users on delete cascade primary key,
  body_weight real default 75,
  current_1rm_muscleup real default 90,
  current_1rm_pullup real default 115,
  current_1rm_dips real default 135,
  current_1rm_squat real default 140,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Completed Sessions Table
create table public.completed_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  week_number integer not null,
  day_number integer not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  total_volume real not null
);

-- 4. Create Exercise Logs Table
create table public.exercise_logs (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.completed_sessions(id) on delete cascade,
  user_id uuid references auth.users on delete cascade not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  exercise_name text not null,
  body_weight_used real not null,
  added_weight real not null,
  total_weight real not null,
  reps integer not null,
  rpe real,
  form_tags text[],
  calculated_1rm real not null,
  is_pr boolean default false
);

-- 5. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.completed_sessions enable row level security;
alter table public.exercise_logs enable row level security;

-- 6. Create RLS Policies
-- Profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Completed Sessions
create policy "Users can view own sessions" on public.completed_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.completed_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.completed_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own sessions" on public.completed_sessions for delete using (auth.uid() = user_id);

-- Exercise Logs
create policy "Users can view own exercise logs" on public.exercise_logs for select using (auth.uid() = user_id);
create policy "Users can insert own exercise logs" on public.exercise_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own exercise logs" on public.exercise_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own exercise logs" on public.exercise_logs for delete using (auth.uid() = user_id);

-- 7. Trigger to automatically create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();