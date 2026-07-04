import { useState } from 'react'
import { signIn, signUpWithPassword, sendMagicLink } from '../lib/api'
import { Button, Segmented } from './ui'

type Mode = 'login' | 'register'

export function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit() {
    if (!email.trim() || !password) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
        // 成功後 onAuthStateChange 會自動帶進 app
      } else {
        const { needsConfirm } = await signUpWithPassword(email.trim(), password)
        if (needsConfirm) {
          setMsg('註冊成功，請到信箱點確認連結後再登入。')
          setMode('login')
        }
        // 沒有 needsConfirm 代表已直接登入，會自動進 app
      }
    } catch (e: any) {
      setErr(translate(e?.message))
    } finally {
      setBusy(false)
    }
  }

  async function useLink() {
    if (!email.trim()) {
      setErr('先填 email，再用連結登入')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await sendMagicLink(email.trim())
      setMsg('登入連結已寄出，點信裡的連結也能進來。')
    } catch (e: any) {
      setErr(e?.message ?? '寄送失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark">⌂</span>
          <h1>家務室友</h1>
        </div>
        <p className="brand-sub">跟室友一起分家務、排洗衣、算清帳。</p>

        <div style={{ marginBottom: 18 }}>
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m)
              setErr(null)
              setMsg(null)
            }}
            options={[
              { value: 'login', label: '登入' },
              { value: 'register', label: '註冊' },
            ]}
          />
        </div>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>密碼{mode === 'register' && '（至少 6 碼）'}</span>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>

        {err && <p className="error">{err}</p>}
        {msg && <p className="muted small">{msg}</p>}

        <Button onClick={submit} disabled={busy}>
          {busy ? '處理中…' : mode === 'login' ? '登入' : '建立帳號'}
        </Button>

        {mode === 'login' && (
          <p className="muted small" style={{ marginTop: 12, textAlign: 'center' }}>
            <button className="link-quiet" onClick={useLink} style={{ margin: 0 }}>
              沒有密碼？改用登入連結
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

function translate(m?: string): string {
  if (!m) return '發生錯誤，請稍後再試'
  if (m.includes('Invalid login credentials')) return 'Email 或密碼不對'
  if (m.includes('User already registered')) return '這個 email 已註冊過，請直接登入'
  if (m.includes('Password should be')) return '密碼太短，至少 6 碼'
  return m
}
