import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseParticipants,
  settleUp,
} from '../lib/api'
import { friendlyDate, money, todayStr } from '../lib/time'
import { Button, Empty, Modal } from './ui'
import type { Expense } from '../lib/types'

export function Money() {
  const { expenses, balances, members, userId, memberName, household, refresh } = useStore()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  // 兩人情境：淨額為正的人是債權人，為負的是債務人
  const summary = useMemo(() => {
    const withNet = balances.map((b) => ({ ...b, net: Number(b.net) }))
    const creditor = withNet.find((b) => b.net > 0.005)
    const debtor = withNet.find((b) => b.net < -0.005)
    if (!creditor || !debtor) return null
    const amount = Math.min(creditor.net, -debtor.net)
    return { from: debtor.user_id, to: creditor.user_id, amount }
  }, [balances])

  async function settle() {
    if (!summary || !household) return
    if (
      !confirm(
        `記錄一筆結清：${memberName(summary.from)} 付給 ${memberName(summary.to)} $${money(summary.amount)}？`,
      )
    )
      return
    await settleUp({
      household_id: household.id,
      from_user: summary.from,
      to_user: summary.to,
      amount: summary.amount,
      note: null,
    })
    await refresh()
  }

  async function remove(e: Expense) {
    if (!confirm(`刪除「${e.description}」$${money(e.amount)}？`)) return
    await deleteExpense(e.id)
    await refresh()
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>分帳</h1>
        <Button onClick={() => setAdding(true)}>＋ 記一筆</Button>
      </div>

      <div className="balance-card">
        {summary ? (
          <>
            <p className="balance-line">
              <span className="who">{memberName(summary.from)}</span> 欠{' '}
              <span className="who">{memberName(summary.to)}</span>
            </p>
            <p className="balance-amount">${money(summary.amount)}</p>
            <Button variant="quiet" onClick={settle}>
              結清
            </Button>
          </>
        ) : (
          <p className="balance-clear">目前互不相欠 🎉</p>
        )}
      </div>

      <div className="rows tall">
        {expenses.length === 0 ? (
          <Empty>還沒有任何花費。誰幫忙買了東西就「記一筆」。</Empty>
        ) : (
          expenses.map((e) => {
            const canEdit = e.paid_by === userId || e.created_by === userId
            return (
              <div className="row" key={e.id}>
                <div className="row-main">
                  <div className="row-text">
                    <div className="row-title">{e.description}</div>
                    <div className="row-sub">
                      {friendlyDate(e.spent_at)} · {memberName(e.paid_by)} 先付
                    </div>
                  </div>
                </div>
                <div className="row-actions">
                  <span className="amount">${money(e.amount)}</span>
                  {canEdit && (
                    <button className="link-quiet inline" onClick={() => setEditing(e)}>
                      編輯
                    </button>
                  )}
                  {canEdit && (
                    <button className="link-danger" aria-label="刪除" onClick={() => remove(e)}>
                      刪
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {(adding || editing) && household && (
        <ExpenseForm
          expense={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onDone={async () => {
            setAdding(false)
            setEditing(null)
            await refresh()
          }}
        />
      )}
    </div>
  )

  // expense 有值 = 編輯；沒有 = 新增
  function ExpenseForm({
    expense,
    onClose,
    onDone,
  }: {
    expense: Expense | null
    onClose: () => void
    onDone: () => void
  }) {
    const isEdit = !!expense
    const [desc, setDesc] = useState(expense?.description ?? '')
    const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
    const [paidBy, setPaidBy] = useState(expense?.paid_by ?? userId ?? '')
    const [spentAt, setSpentAt] = useState(expense?.spent_at ?? todayStr())
    const [participants, setParticipants] = useState<string[]>(
      expense ? [] : members.map((m) => m.id),
    )
    const [busy, setBusy] = useState(false)

    // 編輯時載入原本的分攤者，預先勾好
    useEffect(() => {
      if (expense) {
        getExpenseParticipants(expense.id).then(setParticipants)
      }
    }, [expense])

    const amt = parseFloat(amount || '0')
    const perShare = participants.length > 0 ? amt / participants.length : 0
    const debts = participants.filter((id) => id !== paidBy)

    function toggle(id: string) {
      setParticipants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    }

    async function save() {
      if (!desc.trim() || amt <= 0 || participants.length === 0) return
      setBusy(true)
      try {
        if (isEdit) {
          await updateExpense(expense!.id, {
            description: desc.trim(),
            amount: amt,
            paid_by: paidBy,
            spent_at: spentAt,
            memberIds: participants,
          })
        } else {
          await createExpense({
            household_id: household!.id,
            description: desc.trim(),
            amount: amt,
            paid_by: paidBy,
            created_by: userId!,
            spent_at: spentAt,
            memberIds: participants,
          })
        }
        onDone()
      } finally {
        setBusy(false)
      }
    }

    return (
      <Modal open title={isEdit ? '編輯花費' : '記一筆'} onClose={onClose}>
        <label className="field">
          <span>買了什麼</span>
          <input
            autoFocus
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="例：衛生紙、代訂飲料"
          />
        </label>
        <label className="field">
          <span>金額</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="field">
          <span>誰先付的</span>
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
          <span className="hint">記帳的是你，但付錢的可以選任何成員（A 付或 B 付都行）。</span>
        </label>

        <div className="field">
          <span>這筆由誰分攤</span>
          <div className="check-list">
            {members.map((m) => (
              <label key={m.id} className={participants.includes(m.id) ? 'chk on' : 'chk'}>
                <input
                  type="checkbox"
                  checked={participants.includes(m.id)}
                  onChange={() => toggle(m.id)}
                />
                <span className="chk-name">{m.display_name}</span>
              </label>
            ))}
          </div>
          <span className="hint">
            只勾一人 = 他欠付款人全額；勾多人 = 平均分攤。只有付款人和被勾選的人看得到這筆。
          </span>
        </div>

        <label className="field">
          <span>日期</span>
          <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
        </label>

        {amt > 0 && participants.length > 0 && (
          <div className="preview">
            {debts.length === 0 ? (
              <span className="muted">由付款人自己分攤，沒有人欠款。</span>
            ) : (
              debts.map((id) => (
                <div key={id}>
                  {memberName(id)} 欠 {memberName(paidBy)} <strong>${money(perShare)}</strong>
                </div>
              ))
            )}
          </div>
        )}

        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={save}
            disabled={busy || !desc.trim() || amt <= 0 || participants.length === 0}
          >
            {busy ? '儲存中…' : isEdit ? '儲存' : '記一筆'}
          </Button>
        </div>
      </Modal>
    )
  }
}
