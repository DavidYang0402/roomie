import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import * as api from './lib/api'
import type { Balance, Expense, LaundryConfig, Member, Task } from './lib/types'

interface Store {
  session: Session | null
  userId: string | null
  loading: boolean
  household: api.HouseholdInfo | null
  members: Member[]
  tasks: Task[]
  laundry: Task[]
  expenses: Expense[]
  balances: Balance[]
  laundryConfig: LaundryConfig | null
  refresh: () => Promise<void>
  reloadHousehold: () => void
  memberName: (id: string | null) => string
}

const Ctx = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside <StoreProvider>')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)

  const [household, setHousehold] = useState<api.HouseholdInfo | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [laundry, setLaundry] = useState<Task[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [laundryConfig, setLaundryConfig] = useState<LaundryConfig | null>(null)

  const householdIdRef = useRef<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    const hid = householdIdRef.current
    if (!hid) return
    const [tk, ld, ex, ba] = await Promise.all([
      api.listTasks(hid),
      api.listLaundry(hid),
      api.listExpenses(hid),
      api.getBalances(hid),
    ])
    setTasks(tk)
    setLaundry(ld)
    setExpenses(ex)
    setBalances(ba)
  }, [])

  // 登入後載入 household + 成員 + 資料
  useEffect(() => {
    if (!authReady) return
    if (!session) {
      setLoading(false)
      setHousehold(null)
      householdIdRef.current = null
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const h = await api.getMyHousehold()
        if (cancelled) return
        setHousehold(h)
        householdIdRef.current = h?.id ?? null
        if (h) {
          const [ms, cfg] = await Promise.all([api.getMembers(h.id), api.getLaundryConfig(h.id)])
          if (cancelled) return
          setMembers(ms)
          setLaundryConfig(cfg)
          await refresh()
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, authReady, refresh, reloadKey])

  // Realtime：家裡任何人改動 → 重新抓資料，室友畫面即時同步
  useEffect(() => {
    const hid = household?.id
    if (!hid) return
    const channel = supabase
      .channel('household-' + hid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [household?.id, refresh])

  const memberName = useCallback(
    (id: string | null) => {
      if (!id) return '未認領'
      const m = members.find((x) => x.id === id)
      return m?.display_name || '成員'
    },
    [members],
  )

  const value: Store = {
    session,
    userId: session?.user.id ?? null,
    loading: loading || !authReady,
    household,
    members,
    tasks,
    laundry,
    expenses,
    balances,
    laundryConfig,
    refresh,
    reloadHousehold: () => setReloadKey((k) => k + 1),
    memberName,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
