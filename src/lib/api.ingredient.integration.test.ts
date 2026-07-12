import { describe, it, expect, beforeAll, vi } from 'vitest'
import { supabase } from './supabase'
import {
  signUpWithPassword,
  createHousehold,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  listIngredients,
  createDish,
  cancelDish,
} from './api'

// 對應 MD/features/Cooking_and_Ingredients.md「Post-Release Fixes」第 1、2 項：
// 食材編輯（update_ingredient RPC）、食材刪除規則（prevent_delete_used_ingredient trigger +
// visible_ingredients.in_use）。跟 api.dish.integration.test.ts 一樣，對 .env 指到的真實
// Supabase 專案跑，不在預設的 `npm test` 裡，需要 `npm run test:integration`。
// 需要該 Supabase 專案已對 Email 開啟 auto-confirm。

vi.setConfig({ testTimeout: 20000 })

let householdId: string
let userId: string

beforeAll(async () => {
  const email = `ingredient-integration-${Date.now()}@example.com`
  const { needsConfirm } = await signUpWithPassword(email, 'TestPassword123!')
  if (needsConfirm) {
    throw new Error('signUp 後沒有拿到 session，這個 Supabase 專案的 Email auto-confirm 可能被關閉了。')
  }
  const { data: u } = await supabase.auth.getUser()
  userId = u.user!.id
  householdId = await createHousehold('Ingredient Integration Test Household')
})

async function seedIngredient(totalPortions: number) {
  const name = `測試食材-${Math.random().toString(36).slice(2, 8)}`
  await createIngredient({
    household_id: householdId,
    name,
    purchased_at: '2026-07-01',
    total_portions: totalPortions,
    created_by: userId,
  })
  const all = await listIngredients(householdId)
  const found = all.find((i) => i.name === name)
  if (!found) throw new Error('seedIngredient: 找不到剛建立的食材')
  return found
}

describe('食材編輯 / 刪除（DB 層，對真實 Supabase 專案跑）', () => {
  it('updateIngredient 成功編輯名稱/購買日期/總份數，remaining_portions 同步位移', async () => {
    const ing = await seedIngredient(4)
    await updateIngredient(ing.id, { name: '改名後的食材', purchased_at: '2026-07-05', total_portions: 10 })

    const after = await listIngredients(householdId)
    const updated = after.find((i) => i.id === ing.id)!
    expect(updated.name).toBe('改名後的食材')
    expect(updated.purchased_at).toBe('2026-07-05')
    expect(updated.total_portions).toBe(10)
    expect(updated.remaining_portions).toBe(10) // 原本沒被分配過，位移後全部都還在
  })

  it('updateIngredient 把總份數改到比「已分配掉的份數」還少時，正確擋下', async () => {
    const ing = await seedIngredient(10)
    // 分配掉 6 份（剩 4）
    await createDish({
      household_id: householdId,
      name: '測試菜-編輯保護',
      planned_date: '2026-07-12',
      items: [{ ingredient_id: ing.id, portions: 6 }],
    })

    // 已分配 6 份，改到只剩 3 份 total 應該被擋下（3 - 已分配6 < 0）
    await expect(
      updateIngredient(ing.id, { name: ing.name, purchased_at: ing.purchased_at, total_portions: 3 }),
    ).rejects.toThrow(/TOTAL_BELOW_ALLOCATED/)

    // 確認沒有被改動
    const after = await listIngredients(householdId)
    const unchanged = after.find((i) => i.id === ing.id)!
    expect(unchanged.total_portions).toBe(10)
    expect(unchanged.remaining_portions).toBe(4)
  })

  it('deleteIngredient 對從沒被使用過的食材直接刪除成功', async () => {
    const ing = await seedIngredient(2)
    await deleteIngredient(ing.id)

    const after = await listIngredients(householdId)
    expect(after.find((i) => i.id === ing.id)).toBeUndefined()
  })

  it('deleteIngredient 對已被 Dish 使用過的食材擋下（INGREDIENT_IN_USE），不刪除', async () => {
    const ing = await seedIngredient(5)
    await createDish({
      household_id: householdId,
      name: '測試菜-刪除保護',
      planned_date: '2026-07-12',
      items: [{ ingredient_id: ing.id, portions: 2 }],
    })

    await expect(deleteIngredient(ing.id)).rejects.toThrow(/INGREDIENT_IN_USE/)

    // 確認食材還在，而且 dish_ingredients 的分配紀錄也沒被連帶砍掉
    const after = await listIngredients(householdId)
    const stillThere = after.find((i) => i.id === ing.id)
    expect(stillThere).toBeDefined()
    expect(stillThere!.in_use).toBe(true)
    expect(stillThere!.remaining_portions).toBe(3) // 分配掉的 2 份仍然存在，沒被 cascade 砍掉
  })

  it('listIngredients 的 in_use 欄位正確反映「有沒有被任何 Dish 引用」', async () => {
    const unused = await seedIngredient(3)
    const used = await seedIngredient(3)
    const dishId = await createDish({
      household_id: householdId,
      name: '測試菜-in_use',
      planned_date: '2026-07-12',
      items: [{ ingredient_id: used.id, portions: 1 }],
    })

    const list1 = await listIngredients(householdId)
    expect(list1.find((i) => i.id === unused.id)!.in_use).toBe(false)
    expect(list1.find((i) => i.id === used.id)!.in_use).toBe(true)

    // 取消這道菜後（退還份數、刪除分配紀錄），in_use 應該變回 false
    await cancelDish(dishId)
    const list2 = await listIngredients(householdId)
    expect(list2.find((i) => i.id === used.id)!.in_use).toBe(false)
  })
})
