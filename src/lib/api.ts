import { supabase } from './supabase'
import { isPastLocalDate } from './time'
import type { Balance, Dish, DishIngredient, Expense, Ingredient, LaundryConfig, Member, Task, Uuid } from './types'

// ---------- Auth ----------
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  // email 確認關閉時，signUp 會直接給 session；若沒 session 代表還要收信確認
  return { needsConfirm: !data.session }
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

// ---------- 建立 / 加入家庭 ----------
export async function createHousehold(name: string): Promise<Uuid> {
  const { data, error } = await supabase.rpc('create_household', { hh_name: name })
  if (error) throw error
  return data as Uuid
}

export async function joinHousehold(code: string): Promise<Uuid> {
  const { data, error } = await supabase.rpc('join_household', { code })
  if (error) {
    if (error.message.includes('INVALID_OR_EXPIRED')) throw new Error('邀請碼不存在、已過期或已被使用')
    throw error
  }
  return data as Uuid
}

export async function createInvite(
  householdId: Uuid,
  ttlMinutes: number,
): Promise<{ code: string; expires_at: string }> {
  const { data, error } = await supabase.rpc('create_invite', {
    hh_id: householdId,
    ttl_minutes: ttlMinutes,
  })
  if (error) throw error
  return data as { code: string; expires_at: string }
}

// ---------- Household ----------
export interface HouseholdInfo {
  id: Uuid
  name: string
}

export async function getMyHousehold(): Promise<HouseholdInfo | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, households(id, name)')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const h = data.households as unknown as HouseholdInfo
  return { id: h.id, name: h.name }
}

export async function getMembers(householdId: Uuid): Promise<Member[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('profiles(id, display_name, birthday)')
    .eq('household_id', householdId)
  if (error) throw error
  return (data ?? []).map((r) => r.profiles as unknown as Member)
}

// ---------- 個人資料 ----------
export interface Profile {
  id: Uuid
  display_name: string
  birthday: string | null
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser()
  const uid = u.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, birthday')
    .eq('id', uid)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function updateMyProfile(patch: { display_name: string; birthday: string | null }) {
  const { data: u } = await supabase.auth.getUser()
  const uid = u.user?.id
  if (!uid) throw new Error('未登入')
  const { error } = await supabase.from('profiles').update(patch).eq('id', uid)
  if (error) throw error
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ---------- Tasks ----------
export async function listTasks(householdId: Uuid): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('household_id', householdId)
    .neq('category', 'laundry')
    .eq('status', 'open')
    .order('due_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as Task[]
}

export interface NewTask {
  household_id: Uuid
  title: string
  scope: 'personal' | 'public'
  due_at: string | null
  assignee_id: Uuid | null
  created_by: Uuid
}

export async function createTask(t: NewTask) {
  const { error } = await supabase.from('tasks').insert({
    household_id: t.household_id,
    title: t.title,
    scope: t.scope,
    category: 'chore',
    due_at: t.due_at,
    assignee_id: t.assignee_id,
    created_by: t.created_by,
  })
  if (error) throw error
}

export interface TaskEdit {
  title: string
  scope: 'personal' | 'public'
  due_at: string | null
  assignee_id: Uuid | null
}

export async function updateTask(id: Uuid, patch: TaskEdit) {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw error
}

// 先搶先贏：只有 assignee_id 還是 null 時才認領得到
export async function claimTask(id: Uuid, userId: Uuid): Promise<boolean> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ assignee_id: userId })
    .eq('id', id)
    .is('assignee_id', null)
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function completeTask(id: Uuid) {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'done', done_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: Uuid) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ---------- Laundry ----------
export async function listLaundry(householdId: Uuid): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('household_id', householdId)
    .eq('category', 'laundry')
    .eq('status', 'open')
    .order('due_at', { ascending: true })
  if (error) throw error
  return data as Task[]
}

export interface NewLaundry {
  household_id: Uuid
  title: string
  recurrence_days: number
  start_date: string // YYYY-MM-DD
  assignee_id: Uuid | null
  created_by: Uuid
}

export async function createLaundry(l: NewLaundry) {
  const { error } = await supabase.from('tasks').insert({
    household_id: l.household_id,
    title: l.title,
    category: 'laundry',
    scope: 'public',
    is_recurring: true,
    recurrence_days: l.recurrence_days,
    due_at: l.start_date,
    assignee_id: l.assignee_id,
    created_by: l.created_by,
  })
  if (error) throw error
}

export interface LaundryEdit {
  title: string
  recurrence_days: number
  due_at: string
  assignee_id: Uuid | null
}

export async function updateLaundry(id: Uuid, patch: LaundryEdit) {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw error
}

export async function getLaundryConfig(householdId: Uuid): Promise<LaundryConfig | null> {
  const { data, error } = await supabase
    .from('laundry_config')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle()
  if (error) throw error
  return data as LaundryConfig | null
}

// ---------- Money ----------
export async function listExpenses(householdId: Uuid): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('household_id', householdId)
    .order('spent_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Expense[]
}

export interface NewExpense {
  household_id: Uuid
  description: string
  amount: number
  paid_by: Uuid
  created_by: Uuid
  spent_at: string
  memberIds: Uuid[] // 參與分攤的人（預設全部成員均分）
}

export async function createExpense(e: NewExpense) {
  // 自己產生 id，插入時不做 RETURNING，這樣在「只有相關人看得到」的 RLS 下也不會卡
  const id = crypto.randomUUID()
  const { error } = await supabase.from('expenses').insert({
    id,
    household_id: e.household_id,
    description: e.description,
    amount: e.amount,
    paid_by: e.paid_by,
    created_by: e.created_by,
    spent_at: e.spent_at,
  })
  if (error) throw error

  // 均分：把 amount 平均攤到每個人，最後一人吸收餘數以確保加總等於 amount
  const n = e.memberIds.length
  const base = Math.floor((e.amount / n) * 100) / 100
  const splits = e.memberIds.map((uid, i) => ({
    expense_id: id,
    user_id: uid,
    share: i === n - 1 ? Math.round((e.amount - base * (n - 1)) * 100) / 100 : base,
  }))
  const { error: se } = await supabase.from('expense_splits').insert(splits)
  if (se) throw se
}

export async function deleteExpense(id: Uuid) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

export async function getExpenseParticipants(expenseId: Uuid): Promise<Uuid[]> {
  const { data, error } = await supabase
    .from('expense_splits')
    .select('user_id')
    .eq('expense_id', expenseId)
  if (error) throw error
  return (data ?? []).map((r) => r.user_id as Uuid)
}

export async function updateExpense(
  id: Uuid,
  patch: { description: string; amount: number; paid_by: Uuid; spent_at: string; memberIds: Uuid[] },
) {
  const { error } = await supabase
    .from('expenses')
    .update({
      description: patch.description,
      amount: patch.amount,
      paid_by: patch.paid_by,
      spent_at: patch.spent_at,
    })
    .eq('id', id)
  if (error) throw error

  // 重建分攤明細（先刪再加）
  const { error: de } = await supabase.from('expense_splits').delete().eq('expense_id', id)
  if (de) throw de
  const n = patch.memberIds.length
  const base = Math.floor((patch.amount / n) * 100) / 100
  const splits = patch.memberIds.map((uid, i) => ({
    expense_id: id,
    user_id: uid,
    share: i === n - 1 ? Math.round((patch.amount - base * (n - 1)) * 100) / 100 : base,
  }))
  const { error: se } = await supabase.from('expense_splits').insert(splits)
  if (se) throw se
}

export async function getBalances(householdId: Uuid): Promise<Balance[]> {
  const { data, error } = await supabase
    .from('balances')
    .select('*')
    .eq('household_id', householdId)
  if (error) throw error
  return data as Balance[]
}

export async function settleUp(args: {
  household_id: Uuid
  from_user: Uuid
  to_user: Uuid
  amount: number
  note: string | null
}) {
  const { error } = await supabase.from('settlements').insert(args)
  if (error) throw error
}

// ---------- 食材 ----------
// 查 visible_ingredients（非 ingredients 本表）：份數用完（remaining_portions=0）且沒有任何
// status='planned' 的 Dish 還引用它時，這個 view 會自動把它濾掉——底層資料不刪除，只是不顯示
// （見 migration_v1_9，2026-07-12 依實際使用回饋修正 Task List 3.4 原本「保留顯示 0」的規則）。
export async function listIngredients(householdId: Uuid): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('visible_ingredients')
    .select('*')
    .eq('household_id', householdId)
    .order('purchased_at', { ascending: true }) // 舊→新（已於 2026-07-12 確認排序方向）
  if (error) throw error
  return data as Ingredient[]
}

export interface NewIngredient {
  household_id: Uuid
  name: string
  purchased_at: string // YYYY-MM-DD
  total_portions: number
  created_by: Uuid
}

export async function createIngredient(i: NewIngredient) {
  const { error } = await supabase.from('ingredients').insert({
    household_id: i.household_id,
    name: i.name,
    purchased_at: i.purchased_at,
    total_portions: i.total_portions,
    remaining_portions: i.total_portions,
    created_by: i.created_by,
  })
  if (error) throw error
}

// ---------- 煮菜規劃 ----------
export interface DishShortage {
  ingredient_id: Uuid
  name: string
  requested: number
  available: number
}

// 份量不足時，create_dish / update_dish_ingredients 這兩個 RPC 會丟出
// 'SHORTAGE:' 開頭 + JSON 陣列的錯誤訊息（見 migration_v1_7/v1_8），這裡轉成結構化物件，
// 對應 Task List 2.4。
export class InsufficientPortionsError extends Error {
  shortages: DishShortage[]
  constructor(shortages: DishShortage[]) {
    super('食材份量不足')
    this.shortages = shortages
  }
}

function parseShortageError(message: string): DishShortage[] | null {
  const prefix = 'SHORTAGE:'
  if (!message.startsWith(prefix)) return null
  try {
    return JSON.parse(message.slice(prefix.length)) as DishShortage[]
  } catch {
    return null
  }
}

function rethrowShortageAware(error: { message: string }): never {
  const shortages = parseShortageError(error.message)
  if (shortages) throw new InsufficientPortionsError(shortages)
  throw error
}

export async function listDishes(householdId: Uuid): Promise<Dish[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('household_id', householdId)
    .order('planned_date', { ascending: true })
  if (error) throw error
  return data as Dish[]
}

export async function getDishIngredients(dishId: Uuid): Promise<DishIngredient[]> {
  const { data, error } = await supabase.from('dish_ingredients').select('*').eq('dish_id', dishId)
  if (error) throw error
  return data as DishIngredient[]
}

export interface DishItem {
  ingredient_id: Uuid
  portions: number
}

// 一次排定一道菜：份量不足時整批擋下、不寫入任何資料，丟出 InsufficientPortionsError
// （shortages 陣列列出所有不足的食材，不只第一個）。
export async function createDish(args: {
  household_id: Uuid
  name: string
  planned_date: string // YYYY-MM-DD
  items: DishItem[]
}): Promise<Uuid> {
  const { data, error } = await supabase.rpc('create_dish', {
    hh_id: args.household_id,
    dish_name: args.name,
    p_planned_date: args.planned_date,
    items: args.items,
  })
  if (error) rethrowShortageAware(error)
  return data as Uuid
}

// 編輯一道尚未完成的菜所用的食材：先退還舊分配、再依新清單重新分配（份數不足會整段回滾，
// 舊分配也不會被退還掉）。
export async function updateDishIngredients(dishId: Uuid, items: DishItem[]) {
  const { error } = await supabase.rpc('update_dish_ingredients', {
    p_dish_id: dishId,
    items,
  })
  if (error) rethrowShortageAware(error)
}

// 取消一道尚未完成的菜：退還已分配的食材份數，並刪除該筆菜（cascade 移除分配明細）。
// 只能取消 status='planned' 的菜；完成/過期後的自動刪除屬於 Task 4，不走這個函式。
export async function cancelDish(dishId: Uuid) {
  const { error } = await supabase.rpc('cancel_dish', { p_dish_id: dishId })
  if (error) throw error
}

// 完成或過期的菜：直接刪除，不退還已分配的食材份數（份數在建立菜色時就已扣除，
// 這裡只是移除紀錄；跟 cancelDish 的差異就在「有沒有退還份數」）。
export async function deleteDish(dishId: Uuid) {
  const { error } = await supabase.from('dishes').delete().eq('id', dishId)
  if (error) throw error
}

// 使用者點選「完成」：依 AC，完成即自動刪除該道菜，不保留 done 狀態、不退還份數。
export async function completeDish(dishId: Uuid) {
  await deleteDish(dishId)
}

// 清掉「已過了當天」的菜（不退還份數）。依 Architect Review 建議在進站/查詢時即時計算，
// 不使用排程 infra；「當天」判定見 isPastLocalDate()（src/lib/time.ts）。
export async function sweepExpiredDishes(householdId: Uuid): Promise<void> {
  const dishes = await listDishes(householdId)
  const expired = dishes.filter((d) => d.status === 'planned' && isPastLocalDate(d.planned_date))
  for (const d of expired) {
    await deleteDish(d.id)
  }
}
