-- ================================================================
-- 家務室友 · v1.6 遷移：修正「記別人付款的帳」被擋的問題
-- 原因：expense_splits 的寫入政策透過受 RLS 限制的 expenses 查詢來判斷，
--       造成「付款人不是自己時，明細寫不進去」的死結。
-- 解法：改用 security definer 函式取得 household，直接判斷成員身分。
-- 在 Supabase SQL Editor 執行一次即可（可安全重複執行）。
-- ================================================================

-- 取得某筆花費所屬的 household（繞過 RLS，只回一個 uuid）
create or replace function expense_household(exp_id uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select household_id from expenses where id = exp_id;
$$;

-- 明細寫入/刪除：只要是該家庭成員即可（不再經過受限的 expenses 可見性）
drop policy if exists split_insert on expense_splits;
create policy split_insert on expense_splits for insert
  with check (is_member(expense_household(expense_id)));

drop policy if exists split_delete on expense_splits;
create policy split_delete on expense_splits for delete
  using (is_member(expense_household(expense_id)));
