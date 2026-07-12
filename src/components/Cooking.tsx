import { useState } from 'react'
import { useStore } from '../store'
import { createIngredient, createDish, cancelDish, completeDish, InsufficientPortionsError } from '../lib/api'
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

export function Cooking() {
  // ingredients/dishes 現在是全域 store 狀態(Task 6):由 store.tsx 的 refresh() 統一抓取
  // (含 sweepExpiredDishes()),並訂閱 Realtime 自動更新,這個元件不再自己管一份本地狀態。
  const { household, userId, ingredients, dishes, refresh } = useStore()
  const [addingIngredient, setAddingIngredient] = useState(false)
  const [addingDish, setAddingDish] = useState(false)

  async function complete(d: Dish) {
    await completeDish(d.id)
    await refresh()
  }
  async function cancel(d: Dish) {
    if (!confirm(`取消「${d.name}」這道菜？已分配的食材份數會退還。`)) return
    await cancelDish(d.id)
    await refresh()
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
                  <div className="row-title">{i.name}</div>
                  <div className="row-sub">
                    {i.purchased_at} 購入 · 剩 {i.remaining_portions} / {i.total_portions} 份
                  </div>
                </div>
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
                  <button className="link-danger" aria-label="取消" onClick={() => cancel(d)}>
                    取消
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {addingIngredient && household && (
        <IngredientForm
          onClose={() => setAddingIngredient(false)}
          onDone={async () => {
            setAddingIngredient(false)
            await refresh()
          }}
        />
      )}

      {addingDish && household && (
        <DishForm
          ingredients={ingredients}
          onClose={() => setAddingDish(false)}
          onDone={async () => {
            setAddingDish(false)
            await refresh()
          }}
        />
      )}
    </div>
  )

  function IngredientForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [name, setName] = useState('')
    const [purchasedAt, setPurchasedAt] = useState(todayStr())
    const [portions, setPortions] = useState(1)
    const [busy, setBusy] = useState(false)

    async function save() {
      if (!name.trim() || portions < 1) return
      setBusy(true)
      try {
        await createIngredient({
          household_id: household!.id,
          name: name.trim(),
          purchased_at: purchasedAt,
          total_portions: portions,
          created_by: userId!,
        })
        onDone()
      } finally {
        setBusy(false)
      }
    }

    return (
      <Modal open title="新增食材" onClose={onClose}>
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
            type="number"
            min={1}
            value={portions}
            onChange={(e) => setPortions(parseInt(e.target.value || '1', 10))}
          />
          <span className="hint">份數是你自己決定的份量單位，例如一顆高麗菜切成 4 份。</span>
        </label>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={busy || !name.trim() || portions < 1}>
            {busy ? '儲存中…' : '新增'}
          </Button>
        </div>
      </Modal>
    )
  }

  function DishForm({
    ingredients,
    onClose,
    onDone,
  }: {
    ingredients: Ingredient[]
    onClose: () => void
    onDone: () => void
  }) {
    const [name, setName] = useState('')
    const [plannedDate, setPlannedDate] = useState(todayStr())
    const [picked, setPicked] = useState<Record<string, number>>({}) // ingredient_id -> portions
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function toggle(ing: Ingredient) {
      setPicked((prev) => {
        const next = { ...prev }
        if (ing.id in next) {
          delete next[ing.id]
        } else {
          next[ing.id] = 1
        }
        return next
      })
    }

    function setQty(ingredientId: string, qty: number) {
      setPicked((prev) => ({ ...prev, [ingredientId]: qty }))
    }

    const items: DishItem[] = Object.entries(picked).map(([ingredient_id, portions]) => ({
      ingredient_id,
      portions,
    }))

    async function save() {
      if (!name.trim() || items.length === 0) return
      setBusy(true)
      setError(null)
      try {
        await createDish({
          household_id: household!.id,
          name: name.trim(),
          planned_date: plannedDate,
          items,
        })
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
      <Modal open title="排菜" onClose={onClose}>
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
          <div className="check-list">
            {ingredients.map((ing) => {
              const on = ing.id in picked
              return (
                <label key={ing.id} className={on ? 'chk on' : 'chk'}>
                  <input type="checkbox" checked={on} onChange={() => toggle(ing)} />
                  <span style={{ flex: 1 }}>
                    {ing.name}
                    <span className="hint" style={{ marginLeft: 6 }}>
                      剩 {ing.remaining_portions} 份
                    </span>
                  </span>
                  {on && (
                    <input
                      type="number"
                      min={1}
                      max={ing.remaining_portions}
                      value={picked[ing.id]}
                      onChange={(e) => setQty(ing.id, parseInt(e.target.value || '1', 10))}
                      className="qty-input"
                    />
                  )}
                </label>
              )
            })}
          </div>
          <span className="hint">勾選要用的食材，並填這道菜要用掉幾份（不限定只能用 1 份）。</span>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={busy || !name.trim() || items.length === 0}>
            {busy ? '儲存中…' : '排定'}
          </Button>
        </div>
      </Modal>
    )
  }
}
