-- ================================================================
-- 家務室友網站 · v1 Schema (Supabase / PostgreSQL)
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上整份 → Run
-- 設計重點：待辦 / 委派 / 洗衣 共用同一張 tasks 表；
--          委派與交換共用同一套 task_requests 同意流程。
-- ================================================================

-- ---------- 0. Enums ----------
create type task_scope     as enum ('personal', 'public');
create type task_status    as enum ('open', 'done');            -- open = 未完成
create type task_category  as enum ('chore', 'laundry', 'other');
create type request_type   as enum ('delegate', 'swap');        -- 委派 / 交換
create type request_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

-- ---------- 1. 家庭 / 成員 / 個人檔案 ----------
create table households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '我們家',
  created_at timestamptz not null default now()
);

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

create table household_members (
  household_id uuid references households(id) on delete cascade,
  user_id      uuid references profiles(id)   on delete cascade,
  role         text not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- 新用戶註冊時自動建立 profile（Supabase 標準做法）
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',
                           split_part(new.email, '@', 1)));
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- 是否為某家庭成員（給 RLS 用；security definer 避免 policy 遞迴）
create or replace function is_member(hid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- ---------- 2. Tasks（待辦 / 家務 / 洗衣共用）----------
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  title          text not null,
  notes          text,
  category       task_category not null default 'chore',
  scope          task_scope    not null default 'public',
  status         task_status   not null default 'open',
  assignee_id    uuid references profiles(id),        -- 公共未認領時為 null
  created_by     uuid not null references profiles(id),
  due_at         timestamptz,
  done_at        timestamptz,
  -- 週期（只有洗衣這類會用到）
  is_recurring   boolean not null default false,
  recurrence_days int,                                -- 間隔天數
  parent_task_id uuid references tasks(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on tasks (household_id, status);
create index on tasks (assignee_id);

-- 「先搶先贏」認領：前端執行
--   update tasks set assignee_id = auth.uid()
--   where id = :id and assignee_id is null;   ← where 條件保證第一個點的人才成功

-- ---------- 3. 委派 / 交換 請求（同意流程共用）----------
create table task_requests (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references tasks(id) on delete cascade,
  type           request_type   not null,
  from_user      uuid not null references profiles(id),
  to_user        uuid references profiles(id),        -- null = 委派給 ALL
  swap_with_task uuid references tasks(id),            -- 只有 type='swap' 時用
  status         request_status not null default 'pending',
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references profiles(id)
);
create index on task_requests (task_id, status);

-- 委派給 ALL、多人同時接 → 一樣用條件更新保證先接先贏：
--   update task_requests set status='accepted', resolved_by=auth.uid()
--   where id = :id and status='pending';   接受後把 tasks.assignee_id 設為自己。
--   對方拒絕 / 逾時 → status='rejected'，任務仍留原負責人（不會變真空）。

-- ---------- 4. 分帳 ----------
create table expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  description  text not null,
  amount       numeric(12,2) not null check (amount > 0),
  currency     text not null default 'TWD',
  paid_by      uuid not null references profiles(id),  -- 誰先付的
  created_by   uuid not null references profiles(id),
  spent_at     date not null default current_date,
  created_at   timestamptz not null default now()
);

-- 一筆花費怎麼分攤（sum(share) 應 = amount；兩人先做各半即可）
create table expense_splits (
  expense_id uuid references expenses(id) on delete cascade,
  user_id    uuid references profiles(id),
  share      numeric(12,2) not null check (share >= 0),
  primary key (expense_id, user_id)
);

-- 結清紀錄（把餘額歸零）
create table settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  from_user    uuid not null references profiles(id),   -- 付錢的（債務人）
  to_user      uuid not null references profiles(id),   -- 收錢的（債權人）
  amount       numeric(12,2) not null check (amount > 0),
  note         text,
  settled_at   timestamptz not null default now()
);

-- 每人淨額：正 = 別人欠他；負 = 他欠別人
create view balances
with (security_invoker = on) as
with paid as (
  select household_id, paid_by as user_id, sum(amount) amt from expenses group by 1,2
), owed as (
  select e.household_id, s.user_id, sum(s.share) amt
  from expense_splits s join expenses e on e.id = s.expense_id group by 1,2
), settle_out as (
  select household_id, from_user as user_id, sum(amount) amt from settlements group by 1,2
), settle_in as (
  select household_id, to_user as user_id, sum(amount) amt from settlements group by 1,2
)
select m.household_id, m.user_id,
       coalesce(paid.amt,0) - coalesce(owed.amt,0)
     + coalesce(settle_out.amt,0) - coalesce(settle_in.amt,0) as net
from household_members m
left join paid       on paid.household_id=m.household_id       and paid.user_id=m.user_id
left join owed       on owed.household_id=m.household_id       and owed.user_id=m.user_id
left join settle_out on settle_out.household_id=m.household_id and settle_out.user_id=m.user_id
left join settle_in  on settle_in.household_id=m.household_id  and settle_in.user_id=m.user_id;

-- ---------- 5. 洗衣名額（你的「1+2」：平日/週末每日上限）----------
create table laundry_config (
  household_id     uuid primary key references households(id) on delete cascade,
  weekday_capacity int not null default 1,
  weekend_capacity int not null default 2
);

-- 某日的洗衣名額上限
create or replace function laundry_capacity_on(hid uuid, d date)
returns int language sql stable as $$
  select case when extract(isodow from d) in (6,7)   -- 六、日
              then weekend_capacity else weekday_capacity end
  from laundry_config where household_id = hid;
$$;

-- 從 start_date 起，第一個還有洗衣名額的日子（撞到就順延）
create or replace function next_free_laundry_date(hid uuid, start_date date)
returns date language plpgsql stable as $$
declare d date := start_date; used int; cap int;
begin
  loop
    select count(*) into used from tasks
      where household_id = hid and category = 'laundry'
        and status = 'open' and due_at::date = d;
    cap := coalesce(laundry_capacity_on(hid, d), 1);
    exit when used < cap;
    d := d + 1;
  end loop;
  return d;
end; $$;

-- 洗衣打勾完成 → 自動排下一次（完成日 + 間隔天數起算，名額滿就順延）
create or replace function schedule_next_laundry()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_date date;
begin
  if new.category = 'laundry' and new.is_recurring
     and new.status = 'done' and old.status = 'open' then
    next_date := next_free_laundry_date(
      new.household_id,
      (coalesce(new.done_at, now()))::date + new.recurrence_days
    );
    insert into tasks (household_id, title, category, scope, assignee_id,
                       created_by, due_at, is_recurring, recurrence_days, parent_task_id)
    values (new.household_id, new.title, 'laundry', new.scope, new.assignee_id,
            new.created_by, next_date::timestamptz, true, new.recurrence_days, new.id);
  end if;
  return new;
end; $$;

create trigger trg_schedule_next_laundry
after update on tasks
for each row execute function schedule_next_laundry();

-- ---------- 6. RLS（Row Level Security）----------
alter table households        enable row level security;
alter table profiles          enable row level security;
alter table household_members enable row level security;
alter table tasks             enable row level security;
alter table task_requests     enable row level security;
alter table expenses          enable row level security;
alter table expense_splits    enable row level security;
alter table settlements       enable row level security;
alter table laundry_config    enable row level security;

-- profiles：自己可讀寫；同家成員可讀
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_read_household on profiles for select using (
  exists (select 1 from household_members me
          join household_members them on them.household_id = me.household_id
          where me.user_id = auth.uid() and them.user_id = profiles.id)
);

-- households：成員可讀；登入者可建立
create policy hh_read   on households for select using (is_member(id));
create policy hh_insert on households for insert with check (auth.uid() is not null);

-- members：成員可讀；可把自己加入、或既有成員可邀請室友
create policy hm_read   on household_members for select using (is_member(household_id));
create policy hm_insert on household_members for insert
  with check (user_id = auth.uid() or is_member(household_id));

-- tasks：公共任務同家可見；個人任務只有本人/建立者可見
create policy tasks_read on tasks for select using (
  is_member(household_id)
  and (scope = 'public' or assignee_id = auth.uid() or created_by = auth.uid())
);
create policy tasks_write on tasks for all
  using (is_member(household_id)) with check (is_member(household_id));

-- 其餘：同家成員可讀寫
create policy req_all on task_requests for all using (
  exists (select 1 from tasks t where t.id = task_requests.task_id and is_member(t.household_id))
);
create policy exp_all   on expenses       for all using (is_member(household_id)) with check (is_member(household_id));
create policy split_all on expense_splits for all using (
  exists (select 1 from expenses e where e.id = expense_splits.expense_id and is_member(e.household_id))
);
create policy settle_all  on settlements    for all using (is_member(household_id)) with check (is_member(household_id));
create policy laundry_cfg on laundry_config for all using (is_member(household_id)) with check (is_member(household_id));

-- ================================================================
-- 完成。接著在 SQL Editor 跑一次下面這段，建立你的家 + 洗衣名額設定：
--   insert into households (name) values ('我們家') returning id;   -- 記下這個 id
--   insert into household_members (household_id, user_id)
--     values ('上面的id', auth.uid());
--   insert into laundry_config (household_id) values ('上面的id');
-- （室友註冊後，用同樣方式把他的 user id 加進 household_members 即可。）
-- ================================================================
