import { describe, it, expect, beforeAll, vi } from 'vitest'
import { supabase } from './supabase'
import {
  signUpWithPassword,
  createHousehold,
  createIngredient,
  listIngredients,
  listDishes,
  createDish,
  cancelDish,
  updateDishIngredients,
  getDishIngredients,
  InsufficientPortionsError,
} from './api'
import type { Ingredient } from './types'

// 對應 MD/features/Cooking_and_Ingredients.md Task List 7.2：
// 份數分配 / 釋放 / 份量不足阻擋（含 3.2、3.3 的退還/重新分配情境）。
//
// 這是 integration test，會對 .env 指到的真實 Supabase 專案建立資料（新帳號 + 新 household），
// 不在預設的 `npm test` 裡（見 package.json `test` script 的 --exclude），要跑這份要另外執行
// `npm run test:integration`。需要該 Supabase 專案已對 Email 開啟 auto-confirm（跟本對話稍早
// 手動驗證 Realtime/RLS 時的前提一樣），否則 signUp 後拿不到 session，beforeAll 會直接失敗並停止。
//
// ⚠️ 已知限制：跑完不會刪除建立的測試帳號（anon key 沒有刪除 auth.users 的權限），累積下來需要
// 你到 Supabase Dashboard 手動清理，跟之前對話中手動測試留下的帳號屬於同一類問題。

vi.setConfig({ testTimeout: 20000 })

let householdId: string
let userId: string

beforeAll(async () => {
  const email = `dish-integration-${Date.now()}@example.com`
  const { needsConfirm } = await signUpWithPassword(email, 'TestPassword123!')
  if (needsConfirm) {
    throw new Error(
      'signUp 後沒有拿到 session：這個 Supabase 專案的 Email auto-confirm 可能被關閉了，' +
        'integration test 需要 auto-confirm 才能跑（見檔案開頭說明）。',
    )
  }
  const { data: u } = await supabase.auth.getUser()
  userId = u.user!.id
  householdId = await createHousehold('Dish Integration Test Household')
})

async function seedIngredient(totalPortions: number): Promise<Ingredient> {
  const name = `測試食材-${Math.random().toString(36).slice(2, 8)}`
  await createIngredient({
    household_id: householdId,
    name,
    purchased_at: new Date().toISOString().slice(0, 10),
    total_portions: totalPortions,
    created_by: userId,
  })
  const all = await listIngredients(householdId)
  const found = all.find((i) => i.name === name)
  if (!found) throw new Error('seedIngredient: 找不到剛建立的食材')
  return found
}

const today = () => new Date().toISOString().slice(0, 10)

describe('食材份數分配 / 釋放（DB 層，對真實 Supabase 專案跑）', () => {
  it('份量足夠時，create_dish 成功建立並正確扣減 remaining_portions（可指定多份，不限 1 份）', async () => {
    const ing = await seedIngredient(4)
    const dishId = await createDish({
      household_id: householdId,
      name: '測試菜-成功',
      planned_date: today(),
      items: [{ ingredient_id: ing.id, portions: 3 }],
    })
    expect(dishId).toBeTruthy()

    const after = await listIngredients(householdId)
    expect(after.find((i) => i.id === ing.id)?.remaining_portions).toBe(1)

    const dishIngredients = await getDishIngredients(dishId)
    expect(dishIngredients).toEqual([{ dish_id: dishId, ingredient_id: ing.id, portions_used: 3 }])
  })

  it('份量不足時，create_dish 整批擋下、不寫入任何資料，並丟出 InsufficientPortionsError', async () => {
    const ing = await seedIngredient(2)
    await expect(
      createDish({
        household_id: householdId,
        name: '測試菜-不足',
        planned_date: today(),
        items: [{ ingredient_id: ing.id, portions: 5 }],
      }),
    ).rejects.toBeInstanceOf(InsufficientPortionsError)

    const after = await listIngredients(householdId)
    expect(after.find((i) => i.id === ing.id)?.remaining_portions).toBe(2) // 完全沒被扣
  })

  it('多個食材同時不足時，shortages 陣列要列出全部，不是只有第一個', async () => {
    const ingA = await seedIngredient(1)
    const ingB = await seedIngredient(1)

    let caught: unknown
    try {
      await createDish({
        household_id: householdId,
        name: '測試菜-雙重不足',
        planned_date: today(),
        items: [
          { ingredient_id: ingA.id, portions: 5 },
          { ingredient_id: ingB.id, portions: 9 },
        ],
      })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(InsufficientPortionsError)
    const shortages = (caught as InsufficientPortionsError).shortages
    const ids = shortages.map((s) => s.ingredient_id).sort()
    expect(ids).toEqual([ingA.id, ingB.id].sort())
  })

  it('cancel_dish 取消尚未完成的菜時，退還已分配的份數並刪除該筆菜', async () => {
    const ing = await seedIngredient(4)
    const dishId = await createDish({
      household_id: householdId,
      name: '測試菜-取消',
      planned_date: today(),
      items: [{ ingredient_id: ing.id, portions: 2 }],
    })

    await cancelDish(dishId)

    const after = await listIngredients(householdId)
    expect(after.find((i) => i.id === ing.id)?.remaining_portions).toBe(4) // 完整退還

    const dishes = await listDishes(householdId)
    expect(dishes.find((d) => d.id === dishId)).toBeUndefined() // 已刪除
  })

  it('update_dish_ingredients 編輯所用食材時，先退還舊分配、再依新清單重新分配', async () => {
    const ingA = await seedIngredient(4)
    const ingB = await seedIngredient(4)
    const dishId = await createDish({
      household_id: householdId,
      name: '測試菜-編輯',
      planned_date: today(),
      items: [{ ingredient_id: ingA.id, portions: 3 }],
    })

    await updateDishIngredients(dishId, [{ ingredient_id: ingB.id, portions: 2 }])

    const after = await listIngredients(householdId)
    expect(after.find((i) => i.id === ingA.id)?.remaining_portions).toBe(4) // 舊分配已退還
    expect(after.find((i) => i.id === ingB.id)?.remaining_portions).toBe(2) // 新分配已扣減

    const dishIngredients = await getDishIngredients(dishId)
    expect(dishIngredients).toEqual([{ dish_id: dishId, ingredient_id: ingB.id, portions_used: 2 }])
  })

  it('update_dish_ingredients 新清單份量不足時，整段回滾，舊分配維持不變', async () => {
    const ingA = await seedIngredient(4)
    const ingB = await seedIngredient(1) // 只有 1 份，等下故意要求 5 份

    const dishId = await createDish({
      household_id: householdId,
      name: '測試菜-編輯回滾',
      planned_date: today(),
      items: [{ ingredient_id: ingA.id, portions: 3 }],
    })

    await expect(
      updateDishIngredients(dishId, [{ ingredient_id: ingB.id, portions: 5 }]),
    ).rejects.toBeInstanceOf(InsufficientPortionsError)

    const after = await listIngredients(householdId)
    // 舊分配「沒有」被退還（因為新清單不足，整段回滾，含前面的退還動作）
    expect(after.find((i) => i.id === ingA.id)?.remaining_portions).toBe(1)
    expect(after.find((i) => i.id === ingB.id)?.remaining_portions).toBe(1) // 也沒有被扣

    const dishIngredients = await getDishIngredients(dishId)
    expect(dishIngredients).toEqual([{ dish_id: dishId, ingredient_id: ingA.id, portions_used: 3 }]) // 舊分配仍在
  })

  it('cancel_dish 對已完成（status=done）的菜應該拒絕，不做退還', async () => {
    const ing = await seedIngredient(4)
    const dishId = await createDish({
      household_id: householdId,
      name: '測試菜-已完成',
      planned_date: today(),
      items: [{ ingredient_id: ing.id, portions: 2 }],
    })
    // app 目前的 completeDish() 是直接刪除、不會經過 status='done' 這個狀態（見 Task List §4.3），
    // 這裡刻意繞過 api.ts 直接改 DB，製造這個邊界情境，驗證 cancel_dish() 的保護確實有生效。
    const { error } = await supabase.from('dishes').update({ status: 'done' }).eq('id', dishId)
    if (error) throw error

    await expect(cancelDish(dishId)).rejects.toThrow(/DISH_ALREADY_DONE/)

    const after = await listIngredients(householdId)
    expect(after.find((i) => i.id === ing.id)?.remaining_portions).toBe(2) // 沒有被退還
  })
})
