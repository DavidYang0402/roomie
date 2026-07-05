import { useMemo, useState } from 'react'
import { useStore } from './store'
import { signOut, regenerateInviteCode } from './lib/api'
import { Button, Modal } from './components/ui'
import { dueState } from './lib/time'
import { Login } from './components/Login'
import { JoinHousehold } from './components/JoinHousehold'
import { Home } from './components/Home'
import { Tasks } from './components/Tasks'
import { Laundry } from './components/Laundry'
import { Money } from './components/Money'

type Tab = 'home' | 'tasks' | 'laundry' | 'money'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: '首頁', icon: '⌂' },
  { key: 'tasks', label: '待辦', icon: '☑' },
  { key: 'laundry', label: '洗衣', icon: '⟳' },
  { key: 'money', label: '分帳', icon: '＄' },
]

export default function App() {
  const { loading, session, household, tasks, laundry, reloadHousehold } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [showInvite, setShowInvite] = useState(false)

  // 首頁徽章：逾期 + 今天到期的件數
  const homeBadge = useMemo(() => {
    const all = [...tasks, ...laundry]
    return all.filter((t) => {
      const s = dueState(t.due_at)
      return s === 'overdue' || s === 'today'
    }).length
  }, [tasks, laundry])

  async function regenerateCode() {
    if (!household) return
    if (
      !confirm('重新產生後，舊的邀請碼會立刻失效（之前拿到舊碼但還沒加入的人就進不來了）。確定要換一組？')
    )
      return
    await regenerateInviteCode(household.id)
    reloadHousehold()
  }

  if (loading) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    )
  }

  if (!session) return <Login />

  if (!household) return <JoinHousehold />

  return (
    <div className="app">
      <div className="topbar">
        <span className="topbar-name">{household.name}</span>
        <div className="tabs desktop-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'tab on' : 'tab'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === 'home' && homeBadge > 0 && <span className="badge">{homeBadge}</span>}
            </button>
          ))}
        </div>
        <button className="link-quiet" onClick={() => setShowInvite(true)}>
          邀請
        </button>
        <button className="link-quiet" onClick={() => signOut()}>
          登出
        </button>
      </div>

      <Modal open={showInvite} title="邀請室友" onClose={() => setShowInvite(false)}>
        <p className="muted small" style={{ marginBottom: 12 }}>
          把這組邀請碼給室友，他註冊後在「用邀請碼加入」輸入就能進來。只有拿到碼的人才進得來。
        </p>
        <div className="code-box">{household.invite_code}</div>
        <div className="modal-actions" style={{ marginTop: 0 }}>
          <Button variant="ghost" onClick={regenerateCode}>
            重新產生
          </Button>
          <Button variant="quiet" onClick={() => navigator.clipboard?.writeText(household.invite_code)}>
            複製邀請碼
          </Button>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          若邀請碼不小心外流，按「重新產生」換一組，舊碼會立刻失效。
        </p>
      </Modal>

      <main className="content">
        {tab === 'home' && <Home />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'laundry' && <Laundry />}
        {tab === 'money' && <Money />}
      </main>

      <nav className="bottomnav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'navitem on' : 'navitem'}
            onClick={() => setTab(t.key)}
          >
            <span className="navicon">
              {t.icon}
              {t.key === 'home' && homeBadge > 0 && <span className="badge">{homeBadge}</span>}
            </span>
            <span className="navlabel">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
