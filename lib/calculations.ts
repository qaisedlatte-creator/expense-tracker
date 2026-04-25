import type { Project, Expense, Settings, DashboardMetrics } from '@/types'

export function calcDashboard(
  projects: Project[],
  expenses: Expense[],
  settings: Settings
): DashboardMetrics {
  const revenueProjects = projects.filter(
    (p) => p.status === 'Confirmed' || p.status === 'Paid'
  )
  const pendingProjects = projects.filter((p) => p.status === 'Pending')

  const totalRevenue = revenueProjects.reduce((s, p) => s + p.amount, 0)
  const pendingRevenue = pendingProjects.reduce((s, p) => s + p.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
  const capitalRemaining = settings.starting_capital - totalExpenses
  const runway =
    settings.monthly_overhead > 0
      ? capitalRemaining / settings.monthly_overhead
      : Infinity

  return {
    capitalRemaining,
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin,
    monthlyOverhead: settings.monthly_overhead,
    runway,
    pendingRevenue,
  }
}

export function formatINR(amount: number, symbol = '₹'): string {
  const abs = Math.abs(amount)
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(abs)
  const prefix = amount < 0 ? '−' : ''
  return `${prefix}${symbol}${formatted}`
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '' : '−'}${Math.abs(value).toFixed(1)}%`
}

export function formatMonths(months: number): string {
  if (!isFinite(months)) return '∞'
  return `${months.toFixed(1)} mo`
}

export function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export function categoryPercents(
  expenses: Expense[]
): { category: string; pct: number; amount: number }[] {
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const byCategory: Record<string, number> = {}
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
  }
  return Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}
