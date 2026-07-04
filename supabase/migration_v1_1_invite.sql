-- ================================================================
-- 家務室友 · v1.1 遷移：註冊 + 邀請碼加入家庭
-- 在 Supabase SQL Editor 執行一次即可（可安全重複執行）
-- ================================================================

-- 1) 每個家一組唯一邀請碼
alter table households add column if not exists invite_code text unique;

-- 產生 8 碼英數（去掉容易看錯的字）
create or replace function gen_invite_code()
returns text language sql volatile as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           floor(random() * 32)::int + 1, 1), '')
  from generate_series(1, 8);
$$;

-- 幫既有的家補上邀請碼
update households set invite_code = gen_invite_code() where invite_code is null;
alter table households alter column invite_code set not null;

-- 2) 建立新家：建家 + 把自己設為成員 + 洗衣設定，回傳 id 與邀請碼
create or replace function create_household(hh_name text)
returns json language plpgsql security definer set search_path = public as $$
declare new_id uuid; code text;
begin
  code := gen_invite_code();
  insert into households (name, invite_code)
    values (coalesce(nullif(trim(hh_name), ''), '我們家'), code)
    returning id into new_id;
  insert into household_members (household_id, user_id) values (new_id, auth.uid());
  insert into laundry_config (household_id) values (new_id);
  return json_build_object('id', new_id, 'invite_code', code);
end; $$;

-- 3) 用邀請碼加入：驗證碼 → 把自己加進去，回傳 household id
create or replace function join_household(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select id into hid from households where invite_code = upper(trim(code));
  if hid is null then
    raise exception 'INVALID_CODE';   -- 前端會翻成「邀請碼不存在」
  end if;
  insert into household_members (household_id, user_id)
    values (hid, auth.uid())
    on conflict do nothing;
  return hid;
end; $$;

grant execute on function create_household(text) to authenticated;
grant execute on function join_household(text) to authenticated;

-- 4) 收緊成員新增政策：只有現有成員能「直接」加人；
--    自己加入一律走上面的 join_household 函式（security definer 會繞過 RLS）。
drop policy if exists hm_insert on household_members;
create policy hm_insert on household_members for insert
  with check (is_member(household_id));
