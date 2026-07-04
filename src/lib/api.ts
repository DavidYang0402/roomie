import { supabase } from './supabase'
import type { Balance, Expense, LaundryConfig, Member, Task, Uuid } from './types'

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
export async function createHousehold(name: string): Promise<{ id: Uuid; invite_code: string }> {
  const { data, error } = await supabase.rpc('create_household', { hh_name: name })
  if (error) throw error
  return data as { id: Uuid; invite_code: string }
}

export async function joinHousehold(code: string): Promise<Uuid> {
  const { data, error } = await supabase.rpc('join_household', { code })
  if (error) {
    if (error.message.includes('INVALID_CODE')) throw new Error('邀請碼不存在')
    throw error
  }
  return data as Uuid
}

// ---------- Household ----------
export interface HouseholdInfo {
  id: Uuid
  name: string
  invite_code: string
}

export async function getMyHousehold(): Promise<HouseholdInfo | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, households(id, name, invite_code)')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const h = data.households as unknown as HouseholdInfo
  return { id: h.id, name: h.name, invite_code: h.invite_code }
}

export async function getMembers(householdId: Uuid): Promise<Member[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('profiles(id, display_name)')
    .eq('household_id', householdId)
  if (error) throw error
  return (data ?? []).map((r) => r.profiles as unknown as Member)
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
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      household_id: e.household_id,
      description: e.description,
      amount: e.amount,
      paid_by: e.paid_by,
      created_by: e.created_by,
      spent_at: e.spent_at,
    })
    .select('id')
    .single()
  if (error) throw error

  // 均分：把 amount 平均攤到每個人，最後一人吸收餘數以確保加總等於 amount
  const n = e.memberIds.length
  const base = Math.floor((e.amount / n) * 100) / 100
  const splits = e.memberIds.map((uid, i) => ({
    expense_id: data.id as string,
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
