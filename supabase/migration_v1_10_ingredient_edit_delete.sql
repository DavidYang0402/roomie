-- ================================================================
-- 家務室友 · v1.10 遷移:食材編輯 / 刪除(FEAT-001 使用回饋修正)
-- 對應 MD/features/Cooking_and_Ingredients.md,補上編輯與刪除功能。
-- 在 Supabase SQL Editor 執行一次即可(可安全重複執行)。
-- ================================================================

-- ---------- 1. 編輯食材(名稱 / 購買日期 / 總份數)----------
-- 總份數改變時,remaining_portions 跟著同步位移(new_remaining = old_remaining +
-- (new_total - old_total)),維持「已分配的份數不變、只調整池子大小」的語意。
-- 若新總份數小於「已分配掉的份數」(new_remaining 會變負),直接擋下,不允許改到比已用掉的還少。
create or replace function update_ingredient(
  p_id uuid,
  p_name text,
  p_purchased_at date,
  p_total_portions int
)
returns void language plpgsql security definer set search_path = public as $$
declare
  hh uuid;
  old_total int;
  old_remaining int;
  new_remaining int;
begin
  select household_id, total_portions, remaining_portions
    into hh, old_total, old_remaining
    from ingredients where id = p_id;

  if hh is null then
    raise exception 'INGREDIENT_NOT_FOUND';
  end if;
  if not is_member(hh) then
    raise exception 'NOT_MEMBER';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'INVALID_NAME';
  end if;
  if p_total_portions is null or p_total_portions <= 0 then
    raise exception 'INVALID_TOTAL_PORTIONS';
  end if;

  new_remaining := old_remaining + (p_total_portions - old_total);
  if new_remaining < 0 then
    raise exception 'TOTAL_BELOW_ALLOCATED:%', (old_total - old_remaining);
  end if;

  update ingredients
    set name = trim(p_name),
        purchased_at = p_purchased_at,
        total_portions = p_total_portions,
        remaining_portions = new_remaining
    where id = p_id;
end; $$;

grant execute on function update_ingredient(uuid, text, date, int) to authenticated;

-- ---------- 2. 刪除食材:只有「從沒被任何 Dish 使用過」才能刪 ----------
-- ingredients_all 的 RLS policy(v1.7)本來就允許同家成員直接 delete,但 ingredient_id 的 FK 是
-- on delete cascade,直接刪會連帶砍掉 dish_ingredients 的分配紀錄。這裡加一個 trigger 擋下:
-- 只要 dish_ingredients 還有任何一筆引用這個食材(不分該筆 Dish 是什麼狀態),就不准刪除。
create or replace function prevent_delete_used_ingredient()
returns trigger language plpgsql stable as $$
begin
  if exists (select 1 from dish_ingredients where ingredient_id = old.id) then
    raise exception 'INGREDIENT_IN_USE';
  end if;
  return old;
end; $$;

drop trigger if exists trg_prevent_delete_used_ingredient on ingredients;
create trigger trg_prevent_delete_used_ingredient
before delete on ingredients
for each row execute function prevent_delete_used_ingredient();

-- ---------- 3. visible_ingredients view 補上 in_use 欄位 ----------
-- 讓前端不用另外查一次 dish_ingredients 就能知道「這個食材能不能顯示刪除按鈕」。
create or replace view visible_ingredients
with (security_invoker = on) as
select
  i.*,
  exists (
    select 1 from dish_ingredients di where di.ingredient_id = i.id
  ) as in_use
from ingredients i
where not (
  i.remaining_portions = 0
  and not exists (
    select 1
    from dish_ingredients di
    join dishes d on d.id = di.dish_id
    where di.ingredient_id = i.id and d.status = 'planned'
  )
);
