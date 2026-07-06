import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { getMyProfile, updateMyProfile, changePassword, signOut } from '../lib/api'
import { Button } from './ui'

export function Settings() {
  const { members, userId, reloadHousehold } = useStore()

  // --- 我的資料 ---
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [savingP, setSavingP] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    getMyProfile().then((p) => {
      if (p) {
        setName(p.display_name)
        setBirthday(p.birthday ?? '')
      }
    })
  }, [])

  async function saveProfile() {
    if (!name.trim()) return
    setSavingP(true)
    setSavedMsg(null)
    try {
      await updateMyProfile({ display_name: name.trim(), birthday: birthday || null })
      reloadHousehold() // 讓新暱稱在各處即時更新
      setSavedMsg('已儲存')
    } finally {
      setSavingP(false)
    }
  }

  // --- 變更密碼 ---
  const [pw, setPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  async function savePw() {
    if (pw.length < 6) {
      setPwErr('密碼至少 6 碼')
      return
    }
    setPwBusy(true)
    setPwErr(null)
    setPwMsg(null)
    try {
      await changePassword(pw)
      setPw('')
      setPwMsg('密碼已更新')
    } catch (e: any) {
      setPwErr(e?.message ?? '更新失敗')
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>設定</h1>
      </div>

      <section className="settings-card">
        <h2 className="settings-head">我的資料</h2>
        <label className="field">
          <span>暱稱（其他人看到的名字）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的暱稱" />
        </label>
        <label className="field">
          <span>生日</span>
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </label>
        <div className="settings-actions">
          {savedMsg && <span className="muted small">{savedMsg}</span>}
          <Button onClick={saveProfile} disabled={savingP || !name.trim()}>
            {savingP ? '儲存中…' : '儲存'}
          </Button>
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-head">家庭成員</h2>
        <div className="rows">
          {members.map((m) => (
            <div className="row" key={m.id}>
              <div className="row-main">
                <div className="avatar">{(m.display_name || '?').slice(0, 1)}</div>
                <div>
                  <div className="row-title">
                    {m.display_name || '（未命名）'}
                    {m.id === userId && <span className="tag">你</span>}
                  </div>
                  {m.birthday && <div className="row-sub">生日 {m.birthday}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-head">變更密碼</h2>
        <label className="field">
          <span>新密碼（至少 6 碼）</span>
          <input
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </label>
        {pwErr && <p className="error">{pwErr}</p>}
        {pwMsg && <p className="muted small">{pwMsg}</p>}
        <div className="settings-actions">
          <Button variant="ghost" onClick={savePw} disabled={pwBusy || pw.length < 6}>
            {pwBusy ? '更新中…' : '更新密碼'}
          </Button>
        </div>
      </section>

      <section className="settings-card">
        <Button variant="ghost" onClick={() => signOut()}>
          登出
        </Button>
      </section>
    </div>
  )
}
