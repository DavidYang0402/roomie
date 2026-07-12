-- ================================================================
-- 家務室友 · v1.9 遷移:自動隱藏「已用完且無人引用」的食材(FEAT-001 規則修正)
-- 對應 MD/features/Cooking_and_Ingredients.md,修正 Task List 3.4 的原始規則。
-- 在 Supabase SQL Editor 執行一次即可(可安全重複執行)。
-- ================================================================

-- 規則:食材同時符合以下兩個條件時,從清單「隱藏」(不刪除底層資料):
--   1. remaining_portions = 0
--   2. 沒有任何 status='planned' 的 Dish 還透過 dish_ingredients 引用這個食材
--
-- 用 view 而非刪除資料列:即使判斷邏輯有 bug,底層 ingredients 資料完全不受影響,
-- 隨時可以修正 view 定義重新顯示,不會真的弄丟資料。
-- security_invoker = on:沿用查詢者本人的 RLS(is_member),跟 ingredients 表本身的權限一致,
-- 不需要另外幫這個 view 開權限。
create or replace view visible_ingredients
with (security_invoker = on) as
select i.*
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
