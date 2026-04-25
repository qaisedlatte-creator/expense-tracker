import type { Project, Expense, Settings, DashboardMetrics } from '@/types'

// ─── All-time dashboard ────────────────────────────────────────────────────────

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
    settings.monthly_overhead > 0 ? capitalRemaining / settings.monthly_overhead : Infinity

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

// ─── Monthly metrics ──────────────────────────────────────────────────────────

export interface MonthlyMetrics {
  monthName: string
  revenue: number
  pendingRevenue: number
  expenses: number
  netProfit: number
  margin: number
  totalCosts: number        // expenses + overhead
  breakEvenGap: number      // how much more revenue needed to break even (0 if already profitable)
  profitSurplus: number     // how much above break-even (0 if not yet profitable)
  pendingImpact: number     // net profit if all pending converted
  pendingMargin: number
  adSpend: number
  adRatio: number           // ad spend as % of revenue
  // Competitor benchmarks
  benchmarkMargin: number   // 25% for Indian digital agencies
  marginGap: number         // benchmark - current margin
  revenueToHitBenchmark: number  // revenue needed at current expenses to hit 25%
  latestProject: Project | null
  projectCount: number
  activeProjectCount: number
  // Improvement insights (pre-computed strings)
  insights: Insight[]
}

export interface Insight {
  label: string
  value: string
  positive: boolean
}

const BENCHMARK_MARGIN = 25  // % — Indian digital agency standard (year 1)
const BENCHMARK_MONTHLY_REVENUE = 25000  // ₹ — modest target for month 1-2

export function calcMonthlyMetrics(
  projects: Project[],
  expenses: Expense[],
  settings: Settings
): MonthlyMetrics {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const monthExpenses = expenses.filter((e) => e.date.startsWith(ym))
  const monthProjects = projects.filter((p) => p.date.startsWith(ym))

  const revenue = monthProjects
    .filter((p) => p.status === 'Confirmed' || p.status === 'Paid')
    .reduce((s, p) => s + p.amount, 0)

  const pendingRevenue = monthProjects
    .filter((p) => p.status === 'Pending')
    .reduce((s, p) => s + p.amount, 0)

  const expensesTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)
  const totalCosts = expensesTotal + settings.monthly_overhead
  const netProfit = revenue - totalCosts
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0

  const breakEvenGap = netProfit < 0 ? Math.abs(netProfit) : 0
  const profitSurplus = netProfit > 0 ? netProfit : 0

  // What if pending projects converted?
  const pendingImpactProfit = revenue + pendingRevenue - totalCosts
  const pendingMargin =
    revenue + pendingRevenue > 0
      ? (pendingImpactProfit / (revenue + pendingRevenue)) * 100
      : 0

  const adSpend = monthExpenses
    .filter((e) => e.category === 'Ads')
    .reduce((s, e) => s + e.amount, 0)
  const adRatio = revenue > 0 ? (adSpend / revenue) * 100 : 0

  // Benchmark calcs
  const marginGap = BENCHMARK_MARGIN - margin
  // Revenue needed so that (rev - totalCosts) / rev = 0.25
  // → rev * 0.75 = totalCosts → rev = totalCosts / 0.75
  const revenueToHitBenchmark =
    totalCosts > 0 ? totalCosts / (1 - BENCHMARK_MARGIN / 100) : 0

  const latestProject =
    projects.length > 0
      ? [...projects].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      : null

  const activeProjectCount = projects.filter(
    (p) => p.status === 'Confirmed' || p.status === 'Pending'
  ).length

  // ─── Smart insights ─────────────────────────────────────────────────────────
  const insights: Insight[] = []

  // 1. Break-even or profit
  if (netProfit < 0) {
    insights.push({
      label: `${formatINR(breakEvenGap)} more this month = first profit`,
      value: formatINR(breakEvenGap),
      positive: false,
    })
  } else {
    insights.push({
      label: `Profitable by ${formatINR(profitSurplus)} this month`,
      value: formatINR(profitSurplus),
      positive: true,
    })
  }

  // 2. Pending project conversion impact
  if (pendingRevenue > 0 && pendingMargin > margin) {
    insights.push({
      label: `Close pending projects → margin jumps to ${formatPercent(pendingMargin)}`,
      value: formatINR(pendingRevenue),
      positive: true,
    })
  }

  // 3. Ad spend ratio
  if (adRatio > 0) {
    const adBenchmark = 20
    const adStatus = adRatio <= adBenchmark
    insights.push({
      label: adStatus
        ? `Ad spend at ${adRatio.toFixed(0)}% of revenue — within the 20% benchmark`
        : `Ad spend is ${adRatio.toFixed(0)}% of revenue — aim to stay under 20%`,
      value: formatINR(adSpend),
      positive: adStatus,
    })
  }

  // 4. Revenue goal progress
  const revenueProgress = (revenue / BENCHMARK_MONTHLY_REVENUE) * 100
  if (revenue < BENCHMARK_MONTHLY_REVENUE) {
    insights.push({
      label: `${formatINR(BENCHMARK_MONTHLY_REVENUE - revenue)} away from ₹25k/month milestone`,
      value: `${revenueProgress.toFixed(0)}%`,
      positive: false,
    })
  } else {
    insights.push({
      label: `You have crossed the ₹25k/month milestone`,
      value: `${revenueProgress.toFixed(0)}%`,
      positive: true,
    })
  }

  return {
    monthName,
    revenue,
    pendingRevenue,
    expenses: expensesTotal,
    netProfit,
    margin,
    totalCosts,
    breakEvenGap,
    profitSurplus,
    pendingImpact: pendingImpactProfit,
    pendingMargin,
    adSpend,
    adRatio,
    benchmarkMargin: BENCHMARK_MARGIN,
    marginGap,
    revenueToHitBenchmark,
    latestProject,
    projectCount: projects.length,
    activeProjectCount,
    insights,
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

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
  const sign = value >= 0 ? '' : '−'
  return `${sign}${Math.abs(value).toFixed(1)}%`
}

export function formatMonths(months: number): string {
  if (!isFinite(months)) return '∞'
  return `${months.toFixed(1)} mo`
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// ─── Expense breakdown ────────────────────────────────────────────────────────

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
