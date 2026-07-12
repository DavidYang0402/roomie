import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { StoreProvider, useStore } from './store'
import { supabase } from './lib/supabase'
import type { Ingredient } from './lib/types'

// 對應 MD/features/Cooking_and_Ingredients.md Task List 7.1：
// 驗證「我方 household 的 postgres_changes 事件送達後，前端正確更新畫面」——
// 不驗證 RLS（RLS 已在對話中對真實 Supabase 專案實測過，見同一份文件 Task 6 的紀錄）。
// 用假的 supabase.channel()/on()/subscribe() 模擬事件送達，不需要真的連線。

const mockState = vi.hoisted(() => ({ ingredients: [] as Ingredient[] }))

vi.mock('./lib/supabase', () => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn((statusCb?: (status: string) => void) => {
      statusCb?.('SUBSCRIBED')
      return channel
    }),
  }
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  }
})

vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api')>()
  return {
    ...actual,
    getMyHousehold: vi.fn().mockResolvedValue({ id: 'hh-1', name: '我們家' }),
    getMembers: vi.fn().mockResolvedValue([]),
    getLaundryConfig: vi.fn().mockResolvedValue(null),
    listTasks: vi.fn().mockResolvedValue([]),
    listLaundry: vi.fn().mockResolvedValue([]),
    listExpenses: vi.fn().mockResolvedValue([]),
    getBalances: vi.fn().mockResolvedValue([]),
    sweepExpiredDishes: vi.fn().mockResolvedValue(undefined),
    listDishes: vi.fn().mockResolvedValue([]),
    // 回傳目前的 mockState.ingredients「快照」，模擬「refresh() 就是重新查一次目前的真實狀態」。
    listIngredients: vi.fn(() => Promise.resolve([...mockState.ingredients])),
  }
})

const ingredientA: Ingredient = {
  id: 'ing-1',
  household_id: 'hh-1',
  name: '高麗菜',
  purchased_at: '2026-07-01',
  total_portions: 4,
  remaining_portions: 4,
  created_by: 'user-1',
  created_at: '2026-07-01T00:00:00Z',
  in_use: false,
}

function Probe() {
  const { ingredients, loading } = useStore()
  if (loading) return <div>loading</div>
  return (
    <ul>
      {ingredients.map((i) => (
        <li key={i.id}>{i.name}</li>
      ))}
    </ul>
  )
}

describe('store Realtime → UI（Task 7.1）', () => {
  it('ingredients 表的 postgres_changes 事件送達後，refresh() 把最新資料反映到畫面上', async () => {
    mockState.ingredients = []

    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    await waitFor(() => expect(screen.queryByText('loading')).toBeNull())
    expect(screen.queryByText('高麗菜')).toBeNull()

    // 找出 store.tsx 對 ingredients 表註冊的 postgres_changes callback
    const channelResult = vi.mocked(supabase.channel).mock.results[0]?.value
    const onCalls = vi.mocked(channelResult.on).mock.calls
    const ingredientsCall = onCalls.find(([, filter]: any) => filter?.table === 'ingredients')
    expect(ingredientsCall, 'store.tsx 應該要訂閱 ingredients 表').toBeTruthy()
    const handler = ingredientsCall![2] as (payload: unknown) => void

    // 模擬：別人在這個 household 新增了一筆食材（先讓「後端」多這筆資料，再送 Realtime 事件）
    mockState.ingredients = [ingredientA]
    await act(async () => {
      handler({ eventType: 'INSERT', table: 'ingredients', schema: 'public', new: ingredientA, old: {} })
    })

    await waitFor(() => expect(screen.queryByText('高麗菜')).not.toBeNull())
  })
})
