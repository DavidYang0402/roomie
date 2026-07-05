-- ================================================================
-- 家務室友 · v1.2 遷移：分帳可見性
-- 一筆花費只有「付款人」或「被分攤到的人」看得到；
-- 明細與結清也一併鎖定到相關人。
-- 在 Supabase SQL Editor 執行一次即可（可安全重複執行）。
-- ================================================================

-- 判斷目前使用者是否為某筆花費的相關人（付款人 or 分攤者）
-- security definer：內部查詢繞過 RLS，避免政策互相遞迴。
create or replace function can_see_expense(exp_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from expenses e
    where e.id = exp_id and (
      e.paid_by = auth.uid()
      or exists (
        select 1 from expense_splits s
        where s.expense_id = e.id and s.user_id = auth.uid()
      )
    )
  );
$$;

-- ---------- expenses ----------
drop policy if exists exp_all on expenses;

create policy exp_select on expenses for select
  using (is_member(household_id) and can_see_expense(id));

create policy exp_insert on expenses for insert
  with check (is_member(household_id));

-- 只有付款人或建立者能改/刪這筆
create policy exp_update on expenses for update
  using (is_member(household_id) and (paid_by = auth.uid() or created_by = auth.uid()))
  with check (is_member(household_id));

create policy exp_delete on expenses for delete
  using (is_member(household_id) and (paid_by = auth.uid() or created_by = auth.uid()));

-- ---------- expense_splits ----------
drop policy if exists split_all on expense_splits;

-- 只有這筆的相關人看得到明細（含看到別人各分攤多少）
create policy split_select on expense_splits for select
  using (can_see_expense(expense_id));

create policy split_insert on expense_splits for insert
  with check (
    exists (select 1 from expenses e where e.id = expense_splits.expense_id and is_member(e.household_id))
  );

create policy split_delete on expense_splits for delete
  using (
    exists (select 1 from expenses e where e.id = expense_splits.expense_id and is_member(e.household_id))
  );

-- ---------- settlements ----------
-- 結清紀錄只有當事雙方看得到
drop policy if exists settle_all on settlements;

create policy settle_select on settlements for select
  using (is_member(household_id) and (from_user = auth.uid() or to_user = auth.uid()));

create policy settle_insert on settlements for insert
  with check (is_member(household_id));

create policy settle_delete on settlements for delete
  using (is_member(household_id) and (from_user = auth.uid() or to_user = auth.uid()));
