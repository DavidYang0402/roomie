// 全部以「當地日期」為單位思考，避免 UTC 造成差一天的問題。

export function todayStr(): string {
  const d = new Date()
  return toDateStr(d)
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 把 timestamptz / date 字串取出當地日期部分
export function dateOf(ts: string | null): string | null {
  if (!ts) return null
  return toDateStr(new Date(ts))
}

// 純 date 欄位（YYYY-MM-DD，無時間，例如 dishes.planned_date）判斷是否已過了當天。
// 直接比字串，不透過 new Date() 解析——date-only 字串會被 JS 當成 UTC 午夜，在 UTC 以西
// 的時區會少算一天，跟 dueState()/dateOf() 用在 timestamptz 欄位時的情況不同，不能共用。
// today 參數預設用現在的當地日期，測試時可傳入固定值讓結果可預期。
export function isPastLocalDate(dateStr: string, today: string = todayStr()): boolean {
  return dateStr < today
}

export type DueState = 'overdue' | 'today' | 'upcoming' | 'none'

export function dueState(due_at: string | null): DueState {
  const d = dateOf(due_at)
  if (!d) return 'none'
  const today = todayStr()
  if (d < today) return 'overdue'
  if (d === today) return 'today'
  return 'upcoming'
}

// 友善日期：今天 / 明天 / 週幾 / M/D
export function friendlyDate(due_at: string | null): string {
  const d = dateOf(due_at)
  if (!d) return '未排時間'
  const today = new Date(todayStr())
  const target = new Date(d)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  const week = ['日', '一', '二', '三', '四', '五', '六'][target.getDay()]
  if (diff > 1 && diff < 7) return `週${week}`
  return `${target.getMonth() + 1}/${target.getDate()}`
}

export function money(n: number): string {
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}
