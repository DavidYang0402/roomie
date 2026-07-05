import { useState } from 'react'
import { useStore } from '../store'
import { completeTask, createLaundry, updateLaundry, deleteTask } from '../lib/api'
import { dueState, friendlyDate, todayStr, dateOf } from '../lib/time'
import { actionFor } from '../lib/tasks'
import { Button, Empty, Modal } from './ui'
import type { Task } from '../lib/types'

export function Laundry() {
  const { laundry, userId, memberName, members, household, laundryConfig, refresh } = useStore()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  async function done(t: Task) {
    await completeTask(t.id)
    await refresh() // 完成後 DB trigger 會自動排下一次
  }
  async function remove(t: Task) {
    if (!confirm(`刪除「${t.title}」這筆洗衣安排？`)) return
    await deleteTask(t.id)
    await refresh()
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>洗衣</h1>
        <Button onClick={() => setAdding(true)}>＋ 排洗衣</Button>
      </div>

      {laundryConfig && (
        <p className="note">
          每日名額：平日 {laundryConfig.weekday_capacity} 位、週末 {laundryConfig.weekend_capacity} 位。
          排下一次時若當天已滿，會自動順延到下一個有空的日子。
        </p>
      )}

      <div className="rows tall">
        {laundry.length === 0 ? (
          <Empty>還沒有洗衣安排。按「排洗衣」設定從哪天開始、每幾天洗一次。</Empty>
        ) : (
          laundry.map((t) => {
            const state = dueState(t.due_at)
            const action = actionFor(t, userId)
            return (
              <div className="row" key={t.id}>
                <div className="row-main">
                  <span className={`dot ${state}`} />
                  <div>
                    <div className="row-title">
                      <span className="tag laundry">每 {t.recurrence_days} 天</span>
                      {t.title}
                    </div>
                    <div className="row-sub">
                      {friendlyDate(t.due_at)} · {memberName(t.assignee_id)}
                    </div>
                  </div>
                </div>
                <div className="row-actions">
                  {action === 'complete' && (
                    <button className="done-btn" onClick={() => done(t)}>
                      完成
                    </button>
                  )}
                  <button className="link-quiet inline" aria-label="編輯" onClick={() => setEditing(t)}>
                    編輯
                  </button>
                  <button className="link-danger" aria-label="刪除" onClick={() => remove(t)}>
                    刪
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {(adding || editing) && household && (
        <LaundryForm
          task={editing}
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

  // task 有值 = 編輯；沒有 = 新增
  function LaundryForm({
    task,
    onClose,
    onDone,
  }: {
    task: Task | null
    onClose: () => void
    onDone: () => void
  }) {
    const isEdit = !!task
    const [title, setTitle] = useState(task?.title ?? '洗衣服')
    const [days, setDays] = useState(task?.recurrence_days ?? 3)
    const [start, setStart] = useState(dateOf(task?.due_at ?? null) ?? todayStr())
    const [assignee, setAssignee] = useState<string>(task?.assignee_id ?? userId ?? '')
    const [busy, setBusy] = useState(false)

    async function save() {
      if (!title.trim() || days < 1) return
      setBusy(true)
      try {
        if (isEdit) {
          await updateLaundry(task!.id, {
            title: title.trim(),
            recurrence_days: days,
            due_at: start,
            assignee_id: assignee || null,
          })
        } else {
          await createLaundry({
            household_id: household!.id,
            title: title.trim(),
            recurrence_days: days,
            start_date: start,
            assignee_id: assignee || null,
            created_by: userId!,
          })
        }
        onDone()
      } finally {
        setBusy(false)
      }
    }

    return (
      <Modal open title={isEdit ? '編輯洗衣' : '排洗衣'} onClose={onClose}>
        <label className="field">
          <span>名稱</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="洗衣服" />
        </label>
        <label className="field">
          <span>{isEdit ? '下一次是哪天' : '從哪天開始'}</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>每幾天洗一次</span>
          <input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value || '1', 10))}
          />
          <span className="hint">洗好按完成後，會從完成日 + {days} 天自動排下一次。</span>
        </label>
        <label className="field">
          <span>誰洗（洗衣是公共的，大家都看得到）</span>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">不指定</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={busy || !title.trim()}>
            {busy ? '儲存中…' : isEdit ? '儲存' : '建立'}
          </Button>
        </div>
      </Modal>
    )
  }
}
