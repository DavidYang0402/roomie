import { useState } from 'react'
import { useStore } from '../store'
import { createHousehold, joinHousehold, signOut } from '../lib/api'
import { Button, Segmented } from './ui'

type Mode = 'join' | 'create'

export function JoinHousehold() {
  const { reloadHousehold, memberName, userId } = useStore()
  const [mode, setMode] = useState<Mode>('join')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function join() {
    if (!code.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await joinHousehold(code.trim())
      reloadHousehold() // 重新載入，進入家裡
    } catch (e: any) {
      setErr(e?.message ?? '加入失敗')
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    setBusy(true)
    setErr(null)
    try {
      await createHousehold(name)
      reloadHousehold() // 建好後直接進入；要加室友時在 app 內用「邀請」產生限時碼
    } catch (e: any) {
      setErr(e?.message ?? '建立失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <h1 style={{ marginBottom: 6 }}>嗨，{memberName(userId)}</h1>
        <p className="brand-sub">你還沒有家。用室友給的邀請碼加入，或自己開一個。</p>

        <div style={{ marginBottom: 18 }}>
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m)
              setErr(null)
            }}
            options={[
              { value: 'join', label: '用邀請碼加入' },
              { value: 'create', label: '建立新的家' },
            ]}
          />
        </div>

        {mode === 'join' ? (
          <>
            <label className="field">
              <span>邀請碼</span>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="例：K7QМ3P9X"
                onKeyDown={(e) => e.key === 'Enter' && join()}
                style={{ letterSpacing: '0.15em', fontWeight: 600 }}
              />
            </label>
            {err && <p className="error">{err}</p>}
            <Button onClick={join} disabled={busy || !code.trim()}>
              {busy ? '加入中…' : '加入'}
            </Button>
          </>
        ) : (
          <>
            <label className="field">
              <span>家的名字</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="我們家"
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
            </label>
            {err && <p className="error">{err}</p>}
            <Button onClick={create} disabled={busy}>
              {busy ? '建立中…' : '建立'}
            </Button>
          </>
        )}

        <p className="muted small" style={{ marginTop: 16, textAlign: 'center' }}>
          <button className="link-quiet" onClick={() => signOut()} style={{ margin: 0 }}>
            登出
          </button>
        </p>
      </div>
    </div>
  )
}
