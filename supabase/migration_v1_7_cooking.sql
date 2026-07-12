-- ================================================================
-- 家務室友 · v1.7 遷移:食材管理 + 煮菜規劃(FEAT-001)
-- 對應 MD/features/Cooking_and_Ingredients.md
-- 在 Supabase SQL Editor 執行一次即可(可安全重複執行)
-- ================================================================

-- ---------- 0. Enums ----------
do $$ begin
  create type dish_status as enum ('planned', 'done');
exception when duplicate_object then null;
end $$;

-- ---------- 1. 食材 ----------
-- 一份食材是使用者自訂的份量單位(例如一塊牛肉切 6 份、一顆高麗菜分 4 份),
-- 系統不規定「一份」等於多少實際重量/數量。
create table if not exists ingredients (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references households(id) on delete cascade,
  name               text not null,
  purchased_at       date not null default current_date,
  total_portions     int not null check (total_portions > 0),
  remaining_portions int not null check (remaining_portions >= 0),
  created_by         uuid not null references profiles(id),
  created_at         timestamptz not null default now(),
  check (remaining_portions <= total_portions)
);
create index if not exists ingredients_household_purchased_idx
  on ingredients (household_id, purchased_at);

-- ---------- 2. 菜(煮菜規劃) ----------
create table if not exists dishes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  planned_date date not null,
  status       dish_status not null default 'planned',
  created_by   uuid not null references profiles(id),
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);
create index if not exists dishes_household_planned_idx
  on dishes (household_id, planned_date);

-- ---------- 3. 菜 ↔ 食材 分配關聯 ----------
-- portions_used 為使用者指定的正整數,不限定每次只能用 1 份(例如一餐用掉高麗菜 2 份)。
create table if not exists dish_ingredients (
  dish_id       uuid not null references dishes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  portions_used int not null check (portions_used > 0),
  primary key (dish_id, ingredient_id)
);

-- ---------- 4. 原子建立 Dish + 分配食材份數(整批檢查份量是否足夠)----------
-- items 格式:[{"ingredient_id": "...", "portions": 2}, ...]
-- 份量不足時「整批」擋下、不寫入任何資料,並把所有不足的食材一次收進 shortages 陣列回報
-- (不是只回報第一個不足的食材)。錯誤格式:
--   raise 訊息開頭為 'SHORTAGE:' + JSON 陣列,前端可用
--   error.message.startsWith('SHORTAGE:') 判斷並 JSON.parse 剩餘部分取得明細。
--
-- 併發扣減(兩人同時排菜搶用同一份食材)未在此加鎖處理 —— 依 Decision,
-- 這是已知且接受的限制,不在第一版處理。
create or replace function create_dish(
  hh_id uuid,
  dish_name text,
  p_planned_date date,
  items jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_dish_id uuid;
  shortages jsonb := '[]'::jsonb;
  item record;
  avail int;
  iname text;
begin
  if not is_member(hh_id) then
    raise exception 'NOT_MEMBER';
  end if;

  if items is null or jsonb_array_length(items) = 0 then
    raise exception 'NO_INGREDIENTS';
  end if;

  -- 第一輪:逐一檢查份數是否足夠,不足的收進 shortages,先不動任何資料
  for item in select * from jsonb_to_recordset(items) as x(ingredient_id uuid, portions int)
  loop
    if item.ingredient_id is null or item.portions is null or item.portions <= 0 then
      raise exception 'INVALID_ITEM';
    end if;

    select remaining_portions, name into avail, iname
      from ingredients
      where id = item.ingredient_id and household_id = hh_id;

    if avail is null then
      raise exception 'INGREDIENT_NOT_FOUND: %', item.ingredient_id;
    end if;

    if avail < item.portions then
      shortages := shortages || jsonb_build_object(
        'ingredient_id', item.ingredient_id,
        'name', iname,
        'requested', item.portions,
        'available', avail
      );
    end if;
  end loop;

  if jsonb_array_length(shortages) > 0 then
    raise exception 'SHORTAGE:%', shortages::text;
  end if;

  -- 第二輪:份數都夠 → 建立 dish、寫入分配明細、扣減份數(同一交易,任何一步失敗整批回滾)
  insert into dishes (household_id, name, planned_date, created_by)
    values (hh_id, dish_name, p_planned_date, auth.uid())
    returning id into new_dish_id;

  for item in select * from jsonb_to_recordset(items) as x(ingredient_id uuid, portions int)
  loop
    insert into dish_ingredients (dish_id, ingredient_id, portions_used)
      values (new_dish_id, item.ingredient_id, item.portions);

    update ingredients set remaining_portions = remaining_portions - item.portions
      where id = item.ingredient_id;
  end loop;

  return new_dish_id;
end; $$;

grant execute on function create_dish(uuid, text, date, jsonb) to authenticated;

-- ---------- 5. RLS ----------
alter table ingredients      enable row level security;
alter table dishes           enable row level security;
alter table dish_ingredients enable row level security;

-- 食材:同家成員可直接讀寫(新增/檢視食材是單表操作,沒有跨表原子性需求,
-- 不需要走 RPC —— 比照既有 laundry_config 的做法,信任同家成員)
drop policy if exists ingredients_all on ingredients;
create policy ingredients_all on ingredients for all
  using (is_member(household_id)) with check (is_member(household_id));

-- 菜:同家成員可讀;新增一律走 create_dish() RPC(security definer 繞過 RLS 寫入),
-- 直接 update/delete 開放給同家成員,供之後完成/取消菜色使用(見 Task List §3、§4)
drop policy if exists dishes_read on dishes;
create policy dishes_read on dishes for select using (is_member(household_id));

drop policy if exists dishes_write on dishes;
create policy dishes_write on dishes for update using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists dishes_delete on dishes;
create policy dishes_delete on dishes for delete using (is_member(household_id));

-- 菜 ↔ 食材分配明細:同家成員可讀;新增一律走 create_dish() RPC;
-- 刪除開放給同家成員(供刪除/取消菜色時退還份數的邏輯使用,見 Task List §3.2/§3.3)
drop policy if exists dish_ingredients_read on dish_ingredients;
create policy dish_ingredients_read on dish_ingredients for select using (
  exists (select 1 from dishes d where d.id = dish_ingredients.dish_id and is_member(d.household_id))
);

drop policy if exists dish_ingredients_delete on dish_ingredients;
create policy dish_ingredients_delete on dish_ingredients for delete using (
  exists (select 1 from dishes d where d.id = dish_ingredients.dish_id and is_member(d.household_id))
);

-- ---------- 6. 加入 Realtime publication ----------
-- 寫進 migration 版控(而非 Dashboard 手動勾選),避免重演過去「新表忘記加進 publication、
-- 即時更新靜默失效」的問題。用 DO block 檢查是否已加入,確保可安全重複執行。
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ingredients'
  ) then
    alter publication supabase_realtime add table ingredients;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dishes'
  ) then
    alter publication supabase_realtime add table dishes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dish_ingredients'
  ) then
    alter publication supabase_realtime add table dish_ingredients;
  end if;
end $$;
