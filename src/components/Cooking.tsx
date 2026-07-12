import { useEffect, useState } from 'react'
import { useStore } from '../store'
import {
  createIngredient,
  updateIngredient,
  deleteIngredient,
  createDish,
  updateDish,
  cancelDish,
  completeDish,
  getDishIngredients,
  InsufficientPortionsError,
} from '../lib/api'
import type { DishItem } from '../lib/api'
import { todayStr, isPastLocalDate } from '../lib/time'
import { Button, Empty, Modal } from './ui'
import type { Dish, Ingredient } from '../lib/types'

type DishDueState = 'overdue' | 'today' | 'upcoming'
function dishDueState(plannedDate: string): DishDueState {
  if (isPastLocalDate(plannedDate)) return 'overdue'
  if (plannedDate === todayStr()) return 'today'
  return 'upcoming'
}

// 份數輸入一律只留數字（不能是負數或小數，直接把其他字元濾掉，比事後驗證报錯更順手）。
function digitsOnly(v: string): string {
  return v.replace(/[^0-9]/g, '')
}

function explainIngredientError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const belowMatch = msg.match(/TOTAL_BELOW_ALLOCATED:(\d+)/)
  if (belowMatch) return `新總份數不能少於已經分配掉的 ${belowMatch[1]} 份`
  if (msg.includes('INGREDIENT_IN_USE')) return '這個食材已經被某道菜使用過，不能刪除'
  return '儲存失敗，請再試一次'
}

export function Cooking() {
  // ingredients/dishes 現在是全域 store 狀態(Task 6):由 store.tsx 的 refresh() 統一抓取
  // (含 sweepExpiredDishes()),並訂閱 Realtime 自動更新,這個元件不再自己管一份本地狀態。
  const { household, userId, ingredients, dishes, refresh } = useStore()
  const [addingIngredient, setAddingIngredient] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [addingDish, setAddingDish] = useState(false)
  const [editingDish, setEditingDish] = useState<Dish | null>(null)

  async function complete(d: Dish) {
    await completeDish(d.id)
    await refresh()
  }
  async function cancel(d: Dish) {
    if (!confirm(`取消「${d.name}」這道菜？已分配的食材份數會退還。`)) return
    await cancelDish(d.id)
    await refresh()
  }
  async function removeIngredient(i: Ingredient) {
    if (!confirm(`刪除食材「${i.name}」？`)) return
    try {
      await deleteIngredient(i.id)
      await refresh()
    } catch (err) {
      alert(explainIngredientError(err))
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>食材</h1>
        <Button onClick={() => setAddingIngredient(true)}>＋ 新增食材</Button>
      </div>

      <div className="rows tall">
        {ingredients.length === 0 ? (
          <Empty>還沒有食材。按「新增食材」記錄買了什麼、可以用幾份。</Empty>
        ) : (
          ingredients.map((i) => (
            <div className="row" key={i.id}>
              <div className="row-main">
                <div>
                  <div className="row-title">
                    {i.name}
                    {i.in_use && <span className="tag">使用中</span>}
                  </div>
                  <div className="row-sub">
                    {i.purchased_at} 購入 · 剩 {i.remaining_portions} / {i.total_portions} 份
                  </div>
                </div>
              </div>
              <div className="row-actions">
                <button className="link-quiet inline" aria-label="編輯" onClick={() => setEditingIngredient(i)}>
                  編輯
                </button>
                {!i.in_use && (
                  <button className="link-danger" aria-label="刪除" onClick={() => removeIngredient(i)}>
                    刪
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="view-head" style={{ marginTop: 28 }}>
        <h1>煮菜規劃</h1>
        <Button onClick={() => setAddingDish(true)} disabled={ingredients.length === 0}>
          ＋ 排菜
        </Button>
      </div>
      {ingredients.length === 0 && <p className="hint">先新增食材，才能排菜。</p>}

      <div className="rows tall">
        {dishes.length === 0 ? (
          <Empty>還沒有排定的菜。</Empty>
        ) : (
          dishes.map((d) => {
            const state = dishDueState(d.planned_date)
            return (
              <div className="row" key={d.id}>
                <div className="row-main">
                  <span className={`dot ${state}`} />
                  <div>
                    <div className="row-title">{d.name}</div>
                    <div className="row-sub">{d.planned_date}</div>
                  </div>
                </div>
                <div className="row-actions">
                  <button className="done-btn" onClick={() => complete(d)}>
                    完成
                  </button>
                  <button className="link-quiet inline" aria-label="編輯" onClick={() => setEditingDish(d)}>
                    編輯
                  </button>
                  <button className="link-danger" aria-label="取消" onClick={() => cancel(d)}>
                    取消
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {(addingIngredient || editingIngredient) && household && (
        <IngredientForm
          ingredient={editingIngredient}
          onClose={() => {
            setAddingIngredient(false)
            setEditingIngredient(null)
          }}
          onDone={async () => {
            setAddingIngredient(false)
            setEditingIngredient(null)
            await refresh()
          }}
        />
      )}

      {(addingDish || editingDish) && household && (
        <DishForm
          dish={editingDish}
          ingredients={ingredients}
          onClose={() => {
            setAddingDish(false)
            setEditingDish(null)
          }}
          onDone={async () => {
            setAddingDish(false)
            setEditingDish(null)
            await refresh()
          }}
        />
      )}
    </div>
  )

  // ingredient 有值 = 編輯；沒有 = 新增
  function IngredientForm({
    ingredient,
    onClose,
    onDone,
  }: {
    ingredient: Ingredient | null
    onClose: () => void
    onDone: () => void
  }) {
    const isEdit = !!ingredient
    const [name, setName] = useState(ingredient?.name ?? '')
    const [purchasedAt, setPurchasedAt] = useState(ingredient?.purchased_at ?? todayStr())
    const [portionsText, setPortionsText] = useState(ingredient ? String(ingredient.total_portions) : '')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const portions = parseInt(portionsText, 10)
    const portionsValid = portionsText !== '' && Number.isInteger(portions) && portions >= 1
    const canSave = name.trim() !== '' && portionsValid

    async function save() {
      if (!canSave) return
      setBusy(true)
      setError(null)
      try {
        if (isEdit) {
          await updateIngredient(ingredient!.id, {
            name: name.trim(),
            purchased_at: purchasedAt,
            total_portions: portions,
          })
        } else {
          await createIngredient({
            household_id: household!.id,
            name: name.trim(),
            purchased_at: purchasedAt,
            total_portions: portions,
            created_by: userId!,
          })
        }
        onDone()
      } catch (err) {
        setError(explainIngredientError(err))
      } finally {
        setBusy(false)
      }
    }

    return (
      <Modal open title={isEdit ? '編輯食材' : '新增食材'} onClose={onClose}>
        <label className="field">
          <span>名稱</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：雞蛋、高麗菜"
          />
        </label>
        <label className="field">
          <span>購買日期</span>
          <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
        </label>
        <label className="field">
          <span>可使用份數</span>
          <input
            type="text"
            inputMode="numeric"
            value={portionsText}
            onChange={(e) => setPortionsText(digitsOnly(e.target.value))}
            placeholder="例：4"
          />
          <span className="hint">份數是你自己決定的份量單位，例如一顆高麗菜切成 4 份。</span>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={busy || !canSave}>
            {busy ? '儲存中…' : isEdit ? '儲存' : '新增'}
          </Button>
        </div>
      </Modal>
    )
  }

  // dish 有值 = 編輯；沒有 = 新增
  function DishForm({
    dish,
    ingredients,
    onClose,
    onDone,
  }: {
    dish: Dish | null
    ingredients: Ingredient[]
    onClose: () => void
    onDone: () => void
  }) {
    const isEdit = !!dish
    const [name, setName] = useState(dish?.name ?? '')
    const [plannedDate, setPlannedDate] = useState(dish?.planned_date ?? todayStr())
    const [picked, setPicked] = useState<Record<string, string>>({}) // ingredient_id -> 份數文字
    const [originalAllocation, setOriginalAllocation] = useState<Record<string, number>>({})
    const [loadingExisting, setLoadingExisting] = useState(isEdit)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 編輯時載入原本用的食材＋份數，預先勾好（比照 Money.tsx 的 ExpenseForm 做法）
    useEffect(() => {
      if (!dish) return
      let cancelled = false
      getDishIngredients(dish.id).then((rows) => {
        if (cancelled) return
        const alloc: Record<string, number> = {}
        const text: Record<string, string> = {}
        rows.forEach((r) => {
          alloc[r.ingredient_id] = r.portions_used
          text[r.ingredient_id] = String(r.portions_used)
        })
        setOriginalAllocation(alloc)
        setPicked(text)
        setLoadingExisting(false)
      })
      return () => {
        cancelled = true
      }
    }, [dish])

    function toggle(ing: Ingredient) {
      setPicked((prev) => {
        const next = { ...prev }
        if (ing.id in next) {
          delete next[ing.id]
        } else {
          next[ing.id] = '1'
        }
        return next
      })
    }

    function setQtyText(ingredientId: string, text: string) {
      setPicked((prev) => ({ ...prev, [ingredientId]: digitsOnly(text) }))
    }

    // 編輯時，這個食材「有效可分配上限」＝目前剩餘 ＋ 這道菜原本就用掉的份數
    // （update_dish_ingredients 存檔時會先退還舊分配才重新檢查，所以上限要把這部分算回來）。
    function effectiveAvailable(ing: Ingredient): number {
      return ing.remaining_portions + (originalAllocation[ing.id] ?? 0)
    }

    const items: DishItem[] = Object.entries(picked)
      .map(([ingredient_id, text]) => ({ ingredient_id, portions: parseInt(text, 10) }))
      .filter((it) => Number.isInteger(it.portions) && it.portions >= 1)

    const pickedCount = Object.keys(picked).length
    const allQtyValid = pickedCount > 0 && items.length === pickedCount
    const canSave = name.trim() !== '' && allQtyValid && !loadingExisting

    async function save() {
      if (!canSave) return
      setBusy(true)
      setError(null)
      try {
        if (isEdit) {
          await updateDish(dish!.id, { name: name.trim(), planned_date: plannedDate, items })
        } else {
          await createDish({
            household_id: household!.id,
            name: name.trim(),
            planned_date: plannedDate,
            items,
          })
        }
        onDone()
      } catch (err) {
        if (err instanceof InsufficientPortionsError) {
          setError(
            '份量不足：' +
              err.shortages.map((s) => `${s.name}（要 ${s.requested}、剩 ${s.available}）`).join('、'),
          )
        } else {
          setError('儲存失敗，請再試一次')
        }
      } finally {
        setBusy(false)
      }
    }

    return (
      <Modal open title={isEdit ? '編輯菜色' : '排菜'} onClose={onClose}>
        <label className="field">
          <span>菜名</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：番茄炒蛋"
          />
        </label>
        <label className="field">
          <span>哪天煮</span>
          <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        </label>

        <div className="field">
          <span>要用的食材</span>
          {loadingExisting ? (
            <p className="muted small">載入中…</p>
          ) : (
            <div className="ing-pick-list">
              {ingredients.map((ing) => {
                const on = ing.id in picked
                const available = effectiveAvailable(ing)
                return (
                  <div key={ing.id} className={on ? 'ing-pick-row on' : 'ing-pick-row'}>
                    <label className="ing-pick-main">
                      <input type="checkbox" checked={on} onChange={() => toggle(ing)} />
                      <span className="ing-pick-text">
                        <span>{ing.name}</span>
                        <span className="hint">剩 {available} 份</span>
                      </span>
                    </label>
                    {on && (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={picked[ing.id]}
                        onChange={(e) => setQtyText(ing.id, e.target.value)}
                        className="qty-input"
                        aria-label={`${ing.name} 使用份數`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <span className="hint">勾選要用的食材，並填這道菜要用掉幾份（不限定只能用 1 份）。</span>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={busy || !canSave}>
            {busy ? '儲存中…' : isEdit ? '儲存' : '排定'}
          </Button>
        </div>
      </Modal>
    )
  }
}
