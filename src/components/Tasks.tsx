import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { claimTask, completeTask, createTask, deleteTask } from '../lib/api'
import { dueState, friendlyDate, todayStr } from '../lib/time'
import { actionFor } from '../lib/tasks'
import { Button, Empty, Modal, Segmented } from './ui'
import type { Task } from '../lib/types'

type Filter = 'all' | 'mine' | 'unclaimed'

export function Tasks() {
  const { tasks, userId, memberName, members, household, refresh } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)

  const shown = useMemo(() => {
    if (filter === 'mine') return tasks.filter((t) => t.assignee_id === userId)
    if (filter === 'unclaimed') return tasks.filter((t) => t.scope === 'public' && !t.assignee_id)
    return tasks
  }, [tasks, filter, userId])

  async function claim(t: Task) {
    const ok = await claimTask(t.id, userId!)
    if (!ok) alert('這件已經被接走了')
    await refresh()
  }
  async function done(t: Task) {
    await completeTask(t.id)
    await refresh()
  }
  async function remove(t: Task) {
    if (!confirm(`刪除「${t.title}」？`)) return
    await deleteTask(t.id)
    await refresh()
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>待辦</h1>
        <Button onClick={() => setAdding(true)}>＋ 新增</Button>
      </div>

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: '全部' },
          { value: 'mine', label: '我的' },
          { value: 'unclaimed', label: '待認領' },
        ]}
      />

      <div className="rows tall">
        {shown.length === 0 ? (
          <Empty>沒有待辦事項。按「新增」加一件吧。</Empty>
        ) : (
          shown.map((t) => {
            const state = dueState(t.due_at)
            const action = actionFor(t, userId)
            const canDelete = t.created_by === userId || t.assignee_id === userId
            return (
              <div className="row" key={t.id}>
                <div className="row-main">
                  <span className={`dot ${state}`} />
                  <div>
                    <div className="row-title">
                      <span className={`tag ${t.scope}`}>{t.scope === 'public' ? '公共' : '個人'}</span>
                      {t.title}
                    </div>
                    <div className="row-sub">
                      {friendlyDate(t.due_at)} · {memberName(t.assignee_id)}
                    </div>
                  </div>
                </div>
                <div className="row-actions">
                  {action === 'claim' && (
                    <Button variant="quiet" onClick={() => claim(t)}>
                      我來
                    </Button>
                  )}
                  {action === 'complete' && (
                    <button className="done-btn" onClick={() => done(t)}>
                      完成
                    </button>
                  )}
                  {canDelete && (
                    <button className="link-danger" aria-label="刪除" onClick={() => remove(t)}>
                      刪
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {adding && household && (
        <AddTask
          onClose={() => setAdding(false)}
          onDone={async () => {
            setAdding(false)
            await refresh()
          }}
        />
      )}
    </div>
  )

  function AddTask({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [title, setTitle] = useState('')
    const [scope, setScope] = useState<'public' | 'personal'>('public')
    const [due, setDue] = useState(todayStr())
    const [assignee, setAssignee] = useState<string>('') // '' = 未指定
    const [busy, setBusy] = useState(false)

    async function save() {
      if (!title.trim()) return
      setBusy(true)
      try {
        await createTask({
          household_id: household!.id,
          title: title.trim(),
          scope,
          due_at: due || null,
          // 個人任務預設掛自己；公共任務可留空給人認領
          assignee_id: scope === 'personal' ? userId : assignee || null,
          created_by: userId!,
        })
        onDone()
      } finally {
        setBusy(false)
      }
    }

    return (
      <Modal open title="新增待辦" onClose={onClose}>
        <label className="field">
          <span>要做什麼</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：打掃公共區、倒垃圾"
          />
        </label>

        <label className="field">
          <span>類型</span>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'public', label: '公共（大家看得到）' },
              { value: 'personal', label: '個人（只有我）' },
            ]}
          />
        </label>

        <label className="field">
          <span>哪天</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>

        {scope === 'public' && (
          <label className="field">
            <span>指定誰做（可留空給人認領）</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">不指定</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={busy || !title.trim()}>
            {busy ? '新增中…' : '新增'}
          </Button>
        </div>
      </Modal>
    )
  }
}
