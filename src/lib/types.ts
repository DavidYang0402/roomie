export type Uuid = string

export type TaskScope = 'personal' | 'public'
export type TaskStatus = 'open' | 'done'
export type TaskCategory = 'chore' | 'laundry' | 'other'

export interface Member {
  id: Uuid
  display_name: string
  birthday?: string | null
}

export interface Task {
  id: Uuid
  household_id: Uuid
  title: string
  notes: string | null
  category: TaskCategory
  scope: TaskScope
  status: TaskStatus
  assignee_id: Uuid | null
  created_by: Uuid
  due_at: string | null
  done_at: string | null
  is_recurring: boolean
  recurrence_days: number | null
  parent_task_id: Uuid | null
  created_at: string
}

export interface Expense {
  id: Uuid
  household_id: Uuid
  description: string
  amount: number
  currency: string
  paid_by: Uuid
  created_by: Uuid
  spent_at: string
  created_at: string
}

export interface Balance {
  household_id: Uuid
  user_id: Uuid
  net: number
}

export interface LaundryConfig {
  household_id: Uuid
  weekday_capacity: number
  weekend_capacity: number
}

export type DishStatus = 'planned' | 'done'

export interface Ingredient {
  id: Uuid
  household_id: Uuid
  name: string
  purchased_at: string
  total_portions: number
  remaining_portions: number
  created_by: Uuid
  created_at: string
}

export interface Dish {
  id: Uuid
  household_id: Uuid
  name: string
  planned_date: string
  status: DishStatus
  created_by: Uuid
  created_at: string
  done_at: string | null
}

export interface DishIngredient {
  dish_id: Uuid
  ingredient_id: Uuid
  portions_used: number
}
