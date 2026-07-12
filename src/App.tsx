import { useMemo, useState } from 'react'
import { useStore } from './store'
import { createInvite } from './lib/api'
import { Button, Modal, Segmented } from './components/ui'
import { dueState } from './lib/time'
import { Login } from './components/Login'
import { JoinHousehold } from './components/JoinHousehold'
import { Home } from './components/Home'
import { Tasks } from './components/Tasks'
import { Laundry } from './components/Laundry'
import { Money } from './components/Money'
import { Cooking } from './components/Cooking'
import { Settings } from './components/Settings'

type Tab = 'home' | 'tasks' | 'laundry' | 'money' | 'cooking' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: '首頁', icon: '⌂' },
  { key: 'tasks', label: '待辦', icon: '☑' },
  { key: 'laundry', label: '洗衣', icon: '⟳' },
  { key: 'money', label: '分帳', icon: '＄' },
  { key: 'cooking', label: '煮菜', icon: '🍳' },
  { key: 'settings', label: '設定', icon: '⚙' },
]

export default function App() {
  const { loading, session, household, tasks, laundry } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [showInvite, setShowInvite] = useState(false)
  const [ttl, setTtl] = useState(30)
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)

  // 首頁徽章：逾期 + 今天到期的件數
  const homeBadge = useMemo(() => {
    const all = [...tasks, ...laundry]
    return all.filter((t) => {
      const s = dueState(t.due_at)
      return s === 'overdue' || s === 'today'
    }).length
  }, [tasks, laundry])

  async function genInvite() {
    if (!household) return
    setInviteBusy(true)
    try {
      setInvite(await createInvite(household.id, ttl))
    } finally {
      setInviteBusy(false)
    }
  }
  function closeInvite() {
    setShowInvite(false)
    setInvite(null)
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
      </div>

      <Modal open={showInvite} title="邀請室友" onClose={closeInvite}>
        {!invite ? (
          <>
            <p className="muted small" style={{ marginBottom: 14 }}>
              產生一組限時邀請碼給室友。過期或被用過一次後就自動失效，最安全。
            </p>
            <div className="field">
              <span>有效時間</span>
              <Segmented
                value={String(ttl)}
                onChange={(v) => setTtl(Number(v))}
                options={[
                  { value: '10', label: '10 分鐘' },
                  { value: '30', label: '30 分鐘' },
                  { value: '60', label: '1 小時' },
                ]}
              />
            </div>
            <Button onClick={genInvite} disabled={inviteBusy}>
              {inviteBusy ? '產生中…' : '產生邀請碼'}
            </Button>
          </>
        ) : (
          <>
            <div className="code-box">{invite.code}</div>
            <p className="hint" style={{ textAlign: 'center' }}>
              有效至{' '}
              {new Date(invite.expires_at).toLocaleTimeString('zh-TW', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              ，一次有效、逾時或用過就失效。
            </p>
            <div className="modal-actions" style={{ marginTop: 8 }}>
              <Button variant="ghost" onClick={() => setInvite(null)}>
                重新產生
              </Button>
              <Button variant="quiet" onClick={() => navigator.clipboard?.writeText(invite.code)}>
                複製
              </Button>
            </div>
          </>
        )}
      </Modal>

      <main className="content">
        {tab === 'home' && <Home />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'laundry' && <Laundry />}
        {tab === 'money' && <Money />}
        {tab === 'cooking' && <Cooking />}
        {tab === 'settings' && <Settings />}
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
