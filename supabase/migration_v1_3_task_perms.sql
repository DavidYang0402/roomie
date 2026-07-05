-- ================================================================
-- 家務室友 · v1.3 遷移：任務寫入權限（資料庫層）+ 重新產生邀請碼
-- 在 Supabase SQL Editor 執行一次即可（可安全重複執行）。
-- ================================================================

-- ---------- 1. 任務寫入權限 ----------
-- 舊政策：同家成員能改任何任務（只有畫面擋，資料庫沒擋）
drop policy if exists tasks_write on tasks;

-- 新增：只能以自己的身分建立
create policy tasks_insert on tasks for insert
  with check (is_member(household_id) and created_by = auth.uid());

-- 更新：RLS 先確認是同家成員，細節交給下面的 trigger 判斷
create policy tasks_update on tasks for update
  using (is_member(household_id)) with check (is_member(household_id));

-- 刪除：建立者、負責人，或「無人負責的洗衣」可刪
create policy tasks_delete on tasks for delete using (
  is_member(household_id) and (
    created_by = auth.uid()
    or assignee_id = auth.uid()
    or (assignee_id is null and category = 'laundry')
  )
);

-- 用 trigger 精準控管「誰能改這筆、能怎麼改」（同時看得到舊值與新值）
create or replace function enforce_task_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  -- 服務端 / SQL Editor（無登入身分）不受限，方便你手動修資料
  if uid is null then
    return new;
  end if;

  -- 建立者或原負責人：可自由編輯（改內容、重新指派、完成）
  if old.created_by = uid or old.assignee_id = uid then
    return new;
  end if;

  -- 其他人：只有原本「無人負責」時能動，且只能——
  if old.assignee_id is null then
    if new.assignee_id = uid then
      return new;                                  -- (a) 認領給自己
    end if;
    if new.assignee_id is null and old.category = 'laundry' then
      return new;                                  -- (b) 完成無人負責的洗衣
    end if;
  end if;

  raise exception 'NOT_ALLOWED: 你沒有權限修改這個任務';
end; $$;

drop trigger if exists trg_enforce_task_update on tasks;
create trigger trg_enforce_task_update
before update on tasks
for each row execute function enforce_task_update();

-- ---------- 2. 重新產生邀請碼 ----------
-- 讓成員換一組新邀請碼，舊碼即失效（gen_invite_code 在 v1.1 已建立）
create or replace function regenerate_invite_code(hh_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not is_member(hh_id) then
    raise exception 'NOT_MEMBER';
  end if;
  code := gen_invite_code();
  update households set invite_code = code where id = hh_id;
  return code;
end; $$;

grant execute on function regenerate_invite_code(uuid) to authenticated;
