import { useMemo } from 'react'
import { useStore } from '../store'
import { completeTask, claimTask } from '../lib/api'
import { dueState, friendlyDate } from '../lib/time'
import { actionFor } from '../lib/tasks'
import { Button, Empty } from './ui'
import type { Task } from '../lib/types'

export function Home() {
  const { tasks, laundry, userId, memberName, refresh } = useStore()

  const all = useMemo(() => [...tasks, ...laundry], [tasks, laundry])

  const overdue = all.filter((t) => dueState(t.due_at) === 'overdue')
  const today = all.filter((t) => dueState(t.due_at) === 'today')
  // 我要負責的（含未認領的公共任務）
  const mine = all.filter((t) => t.assignee_id === userId)
  const unclaimed = tasks.filter((t) => t.scope === 'public' && !t.assignee_id)

  const hour = new Date().getHours()
  const greeting = hour < 5 ? '夜深了' : hour < 11 ? '早安' : hour < 18 ? '午安' : '晚安'

  async function claim(t: Task) {
    const ok = await claimTask(t.id, userId!)
    if (!ok) alert('這件已經被接走了')
    await refresh()
  }
  async function done(t: Task) {
    await completeTask(t.id)
    await refresh()
  }

  return (
    <div className="view">
      <header className="home-hero">
        <p className="eyebrow">{greeting}，{memberName(userId)}</p>
        <h1 className="home-line">
          {overdue.length + today.length === 0 ? (
            <>今天沒有到期的事，輕鬆一下。</>
          ) : (
            <>
              今天有 <strong>{today.length}</strong> 件要做
              {overdue.length > 0 && (
                <>
                  ，還有 <strong className="hot">{overdue.length}</strong> 件逾期
                </>
              )}
              。
            </>
          )}
        </h1>
      </header>

      <Section title="逾期" tone="overdue" count={overdue.length}>
        {overdue.length === 0 ? (
          <Empty>沒有逾期的事 👍</Empty>
        ) : (
          overdue.map((t) => (
            <Row
              key={t.id}
              t={t}
              who={memberName(t.assignee_id)}
              userId={userId}
              onDone={() => done(t)}
              onClaim={() => claim(t)}
            />
          ))
        )}
      </Section>

      <Section title="今天" tone="today" count={today.length}>
        {today.length === 0 ? (
          <Empty>今天沒有排定的事</Empty>
        ) : (
          today.map((t) => (
            <Row
              key={t.id}
              t={t}
              who={memberName(t.assignee_id)}
              userId={userId}
              onDone={() => done(t)}
              onClaim={() => claim(t)}
            />
          ))
        )}
      </Section>

      {unclaimed.length > 0 && (
        <Section title="公共待認領" tone="upcoming" count={unclaimed.length}>
          {unclaimed.map((t) => (
            <div className="row" key={t.id}>
              <div className="row-main">
                <span className="dot upcoming" />
                <div>
                  <div className="row-title">{t.title}</div>
                  <div className="row-sub">{friendlyDate(t.due_at)} · 還沒有人接</div>
                </div>
              </div>
              <Button variant="quiet" onClick={() => claim(t)}>
                我來
              </Button>
            </div>
          ))}
        </Section>
      )}

      <Section title="我負責的" count={mine.length}>
        {mine.length === 0 ? (
          <Empty>目前沒有掛在你身上的事</Empty>
        ) : (
          mine.map((t) => (
            <Row
              key={t.id}
              t={t}
              who="你"
              userId={userId}
              onDone={() => done(t)}
              onClaim={() => claim(t)}
            />
          ))
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string
  count: number
  tone?: 'overdue' | 'today' | 'upcoming'
  children: React.ReactNode
}) {
  return (
    <section className="home-section">
      <h2 className="section-head">
        {tone && <span className={`dot ${tone}`} />}
        {title}
        {count > 0 && <span className="count">{count}</span>}
      </h2>
      <div className="rows">{children}</div>
    </section>
  )
}

function Row({
  t,
  who,
  userId,
  onDone,
  onClaim,
}: {
  t: Task
  who: string
  userId: string | null
  onDone: () => void
  onClaim: () => void
}) {
  const state = dueState(t.due_at)
  const action = actionFor(t, userId)
  return (
    <div className="row">
      <div className="row-main">
        <span className={`dot ${state}`} />
        <div>
          <div className="row-title">
            {t.category === 'laundry' && <span className="tag laundry">洗衣</span>}
            {t.title}
          </div>
          <div className="row-sub">
            {friendlyDate(t.due_at)} · {who}
          </div>
        </div>
      </div>
      {action === 'complete' && (
        <button className="done-btn" onClick={onDone}>
          完成
        </button>
      )}
      {action === 'claim' && (
        <Button variant="quiet" onClick={onClaim}>
          我來
        </Button>
      )}
    </div>
  )
}
