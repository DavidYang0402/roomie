-- ================================================================
-- 家務室友 · v1.8 遷移:菜色取消 / 編輯時的份數釋放與重新分配(FEAT-001 Task 3)
-- 對應 MD/features/Cooking_and_Ingredients.md §Task List 3.2、3.3
-- 在 Supabase SQL Editor 執行一次即可(可安全重複執行)
-- ================================================================

-- ---------- 1. 共用邏輯抽出:檢查份量是否足夠 + 寫入分配 + 扣減份數 ----------
-- 從 v1.7 的 create_dish() 抽出,供 create_dish() 與 update_dish_ingredients() 共用,
-- 避免「整批檢查、不足回傳 shortages 陣列」的邏輯寫兩份。
--
-- ⚠️ 安全性:這個 function 本身不驗證呼叫者是否為 hh_id 的成員、也不驗證 p_dish_id 是否
-- 真的屬於 hh_id 這個 household —— 呼叫方(create_dish / update_dish_ingredients)必須先
-- 驗證過。所以刻意 revoke 掉 PUBLIC 的執行權限,不開放給前端直接呼叫(見本檔案最後)。
create or replace function apply_dish_items(p_dish_id uuid, hh_id uuid, items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  shortages jsonb := '[]'::jsonb;
  item record;
  avail int;
  iname text;
begin
  if items is null or jsonb_array_length(items) = 0 then
    raise exception 'NO_INGREDIENTS';
  end if;

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

  for item in select * from jsonb_to_recordset(items) as x(ingredient_id uuid, portions int)
  loop
    insert into dish_ingredients (dish_id, ingredient_id, portions_used)
      values (p_dish_id, item.ingredient_id, item.portions);

    update ingredients set remaining_portions = remaining_portions - item.portions
      where id = item.ingredient_id;
  end loop;
end; $$;

-- ---------- 2. create_dish() 改用共用邏輯(行為不變,純重構)----------
create or replace function create_dish(
  hh_id uuid,
  dish_name text,
  p_planned_date date,
  items jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_dish_id uuid;
begin
  if not is_member(hh_id) then
    raise exception 'NOT_MEMBER';
  end if;

  insert into dishes (household_id, name, planned_date, created_by)
    values (hh_id, dish_name, p_planned_date, auth.uid())
    returning id into new_dish_id;

  -- 份量不足時這裡會 raise exception,連同上面的 insert into dishes 一併回滾
  perform apply_dish_items(new_dish_id, hh_id, items);

  return new_dish_id;
end; $$;

-- ---------- 3. 取消尚未完成的菜(Task 3.2):退還已分配份數,刪除該 dish ----------
-- 只能取消 status = 'planned' 的菜;已經是 'done' 的菜不透過這個函式處理
-- (完成/過期後的自動刪除屬於 Task 4,份數視為已消耗、不退還)。
create or replace function cancel_dish(p_dish_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select id, household_id, status into d from dishes where id = p_dish_id;
  if d.id is null then
    raise exception 'DISH_NOT_FOUND';
  end if;
  if not is_member(d.household_id) then
    raise exception 'NOT_MEMBER';
  end if;
  if d.status <> 'planned' then
    raise exception 'DISH_ALREADY_DONE';
  end if;

  update ingredients i
    set remaining_portions = i.remaining_portions + di.portions_used
    from dish_ingredients di
    where di.dish_id = p_dish_id and di.ingredient_id = i.id;

  delete from dishes where id = p_dish_id;  -- on delete cascade 一併移除 dish_ingredients
end; $$;

-- ---------- 4. 編輯菜色所用食材(Task 3.3):先退還舊分配,再依新清單重新分配 ----------
-- 只能編輯 status = 'planned' 的菜。退還 + 刪除舊列 + 重新分配全部在同一個函式呼叫內,
-- 若新清單份量不足而 raise exception,整段(含退還、刪除)一起回滾,不會卡在中間狀態。
create or replace function update_dish_ingredients(p_dish_id uuid, items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select id, household_id, status into d from dishes where id = p_dish_id;
  if d.id is null then
    raise exception 'DISH_NOT_FOUND';
  end if;
  if not is_member(d.household_id) then
    raise exception 'NOT_MEMBER';
  end if;
  if d.status <> 'planned' then
    raise exception 'DISH_ALREADY_DONE';
  end if;

  update ingredients i
    set remaining_portions = i.remaining_portions + di.portions_used
    from dish_ingredients di
    where di.dish_id = p_dish_id and di.ingredient_id = i.id;

  delete from dish_ingredients where dish_id = p_dish_id;

  perform apply_dish_items(p_dish_id, d.household_id, items);
end; $$;

-- ---------- 5. 權限 ----------
grant execute on function create_dish(uuid, text, date, jsonb)  to authenticated;
grant execute on function cancel_dish(uuid)                     to authenticated;
grant execute on function update_dish_ingredients(uuid, jsonb)  to authenticated;

-- apply_dish_items 不驗證呼叫者身分,不開放前端直接呼叫,只能被上面幾個函式內部呼叫
-- (內部呼叫以函式擁有者身分執行,不受這個 revoke 影響)。
revoke execute on function apply_dish_items(uuid, uuid, jsonb) from public;
