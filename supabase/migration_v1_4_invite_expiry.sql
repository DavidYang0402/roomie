-- ================================================================
-- 家務室友 · v1.4 遷移：限時、單次使用的邀請碼
-- 取代原本的「永久邀請碼」。舊的永久碼在此之後會自動失效。
-- 在 Supabase SQL Editor 執行一次即可（可安全重複執行）。
-- ================================================================

-- 邀請碼加上「有效期限」；並讓 invite_code 可為 null（用過/沒產生時）
alter table households add column if not exists invite_expires_at timestamptz;
alter table households alter column invite_code drop not null;

-- 產生一組限時邀請碼（同時只有一組有效，產生新碼會取代舊碼）
create or replace function create_invite(hh_id uuid, ttl_minutes int)
returns json language plpgsql security definer set search_path = public as $$
declare code text; exp timestamptz;
begin
  if not is_member(hh_id) then
    raise exception 'NOT_MEMBER';
  end if;
  code := gen_invite_code();
  exp  := now() + make_interval(mins => greatest(ttl_minutes, 1));
  update households set invite_code = code, invite_expires_at = exp where id = hh_id;
  return json_build_object('code', code, 'expires_at', exp);
end; $$;

grant execute on function create_invite(uuid, int) to authenticated;

-- 用碼加入：必須存在、未過期；成功後立刻作廢（單次使用）
create or replace function join_household(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select id into hid from households
    where invite_code = upper(trim(code))
      and invite_expires_at is not null
      and invite_expires_at > now()
    for update;
  if hid is null then
    raise exception 'INVALID_OR_EXPIRED';   -- 不存在 / 已過期 / 已用過
  end if;
  insert into household_members (household_id, user_id)
    values (hid, auth.uid())
    on conflict do nothing;
  update households set invite_code = null, invite_expires_at = null where id = hid;
  return hid;
end; $$;

-- 建立新家：不再產生常駐碼（需要時再用 create_invite 產生限時碼）
create or replace function create_household(hh_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  insert into households (name)
    values (coalesce(nullif(trim(hh_name), ''), '我們家'))
    returning id into new_id;
  insert into household_members (household_id, user_id) values (new_id, auth.uid());
  insert into laundry_config (household_id) values (new_id);
  return new_id;
end; $$;

grant execute on function create_household(text) to authenticated;

-- 淘汰舊的永久碼機制
drop function if exists regenerate_invite_code(uuid);

-- 讓現存的舊永久碼立即失效（expires_at 為 null → join 會被擋）
update households set invite_code = null where invite_expires_at is null;
