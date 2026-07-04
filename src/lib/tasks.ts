import type { Task } from './types'

export type RowAction = 'complete' | 'claim' | 'none'

// 誰的任務誰完成：
// - 是我的任務 → 我可以「完成」
// - 沒人認領：公共家務 → 可「我來」認領；洗衣沒有認領概念 → 誰洗誰按「完成」
// - 別人的任務 → 我不能動（不顯示按鈕）
export function actionFor(t: Task, userId: string | null): RowAction {
  if (userId && t.assignee_id === userId) return 'complete'
  if (t.assignee_id === null) {
    return t.category === 'laundry' ? 'complete' : 'claim'
  }
  return 'none'
}
