import { describe, it, expect } from 'vitest'
import { isPastLocalDate } from './time'

// 對應 MD/features/Cooking_and_Ingredients.md Task List 7.3：
// 過期自動刪除的判定邏輯（含「當天」邊界情況）。
// today 明確傳入固定值，測試結果不受實際系統時鐘影響。
describe('isPastLocalDate', () => {
  it('日期早於今天 → 視為過期', () => {
    expect(isPastLocalDate('2026-07-11', '2026-07-12')).toBe(true)
  })

  it('日期就是今天 → 不算過期（避免「還沒過完今天」的誤判）', () => {
    expect(isPastLocalDate('2026-07-12', '2026-07-12')).toBe(false)
  })

  it('日期在今天之後 → 不算過期', () => {
    expect(isPastLocalDate('2026-07-13', '2026-07-12')).toBe(false)
  })

  it('跨月邊界：上個月最後一天 vs 這個月第一天', () => {
    expect(isPastLocalDate('2026-06-30', '2026-07-01')).toBe(true)
    expect(isPastLocalDate('2026-07-01', '2026-06-30')).toBe(false)
  })

  it('跨年邊界：去年最後一天 vs 今年第一天', () => {
    expect(isPastLocalDate('2025-12-31', '2026-01-01')).toBe(true)
  })
})
