export type ProjectStatus = 'Pending' | 'Confirmed' | 'Paid'
export type ExpenseCategory = 'Ads' | 'Tools' | 'Domain' | 'Other'
export type ExpenseType = 'One-Time' | 'Monthly' | 'Variable'

export interface Project {
  id: string
  name: string
  amount: number
  status: ProjectStatus
  date: string
  notes: string | null
  created_at: string
}

export interface Expense {
  id: string
  name: string
  category: ExpenseCategory
  platform: string | null
  amount: number
  type: ExpenseType
  project_id: string | null
  date: string
  notes: string | null
  created_at: string
}

export interface AdSpend {
  id: string
  platform: string
  week_start: string
  budget: number
  spent: number
  created_at: string
}

export interface Settings {
  starting_capital: number
  monthly_overhead: number
  weekly_ad_budget: number
  currency_symbol: string
  business_name: string
}

export interface DashboardMetrics {
  capitalRemaining: number
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
  monthlyOverhead: number
  runway: number
  pendingRevenue: number
}
