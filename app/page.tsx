'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcDashboard, formatINR, formatPercent, formatMonths, getWeekStart } from '@/lib/calculations'
import type { Project, Expense, AdSpend, Settings, DashboardMetrics } from '@/types'
import MetricCard from '@/components/MetricCard'
import AdBudgetCard from '@/components/AdBudgetCard'

const DEFAULT_SETTINGS: Settings = {
  starting_capital: 20000,
  monthly_overhead: 2000,
  weekly_ad_budget: 1500,
  currency_symbol: '₹',
  business_name: 'Webbes',
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [adSpend, setAdSpend] = useState<AdSpend[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    const [{ data: proj }, { data: exp }, { data: ads }, { data: sett }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('ad_spend').select('*').eq('week_start', getWeekStart()),
      supabase.from('settings').select('*'),
    ])

    const p = (proj ?? []) as Project[]
    const e = (exp ?? []) as Expense[]
    const a = (ads ?? []) as AdSpend[]

    const s: Settings = { ...DEFAULT_SETTINGS }
    if (sett) {
      for (const row of sett) {
        if (row.key === 'starting_capital') s.starting_capital = parseFloat(row.value)
        if (row.key === 'monthly_overhead') s.monthly_overhead = parseFloat(row.value)
        if (row.key === 'weekly_ad_budget') s.weekly_ad_budget = parseFloat(row.value)
        if (row.key === 'currency_symbol') s.currency_symbol = row.value
        if (row.key === 'business_name') s.business_name = row.value
      }
    }

    setProjects(p)
    setExpenses(e)
    setAdSpend(a)
    setSettings(s)
    setMetrics(calcDashboard(p, e, s))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_spend' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, loadAll)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadAll])

  async function handleLogSpend(platform: string, amount: number) {
    const week = getWeekStart()
    const existing = adSpend.find((a) => a.platform === platform)
    if (existing) {
      await supabase
        .from('ad_spend')
        .update({ spent: existing.spent + amount })
        .eq('id', existing.id)
    } else {
      const defaultBudget = platform === 'Meta Ads' ? 1000 : 500
      await supabase.from('ad_spend').insert({
        platform,
        week_start: week,
        budget: defaultBudget,
        spent: amount,
      })
    }
    loadAll()
  }

  async function handleShiftBudget(from: string, to: string, amount: number) {
    const fromRow = adSpend.find((a) => a.platform === from)
    const toRow = adSpend.find((a) => a.platform === to)
    if (!fromRow || !toRow) return
    await Promise.all([
      supabase.from('ad_spend').update({ budget: fromRow.budget - amount }).eq('id', fromRow.id),
      supabase.from('ad_spend').update({ budget: toRow.budget + amount }).eq('id', toRow.id),
    ])
    loadAll()
  }

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const runwayWarn = metrics.runway < 2 && isFinite(metrics.runway)

  return (
    <div className="px-4 pt-6 pb-32 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{settings.business_name}</h1>
          <p className="text-xs text-[#555] mt-0.5">Finance Dashboard</p>
        </div>
        <Link href="/settings" className="text-[#555] hover:text-white transition-colors p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <MetricCard
          label="Capital Remaining"
          value={formatINR(Math.abs(metrics.capitalRemaining))}
          negative={metrics.capitalRemaining < 0}
        />
        <MetricCard
          label="Net Profit"
          value={formatINR(Math.abs(metrics.netProfit))}
          sub={formatPercent(metrics.profitMargin) + ' margin'}
          negative={metrics.netProfit < 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <MetricCard
          label="Total Revenue"
          value={formatINR(metrics.totalRevenue)}
          sub={metrics.pendingRevenue > 0 ? `+${formatINR(metrics.pendingRevenue)} pending` : undefined}
        />
        <MetricCard
          label="Total Expenses"
          value={formatINR(metrics.totalExpenses)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <MetricCard
          label="Monthly Overhead"
          value={formatINR(metrics.monthlyOverhead)}
        />
        <MetricCard
          label="Runway"
          value={formatMonths(metrics.runway)}
          sub={runwayWarn ? 'Low — add revenue' : undefined}
          warn={runwayWarn}
        />
      </div>

      {/* Ad Budget */}
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-widest text-[#444] mb-2">Ads This Week</p>
        <AdBudgetCard
          adSpend={adSpend}
          weeklyCapTotal={settings.weekly_ad_budget}
          onLogSpend={handleLogSpend}
          onShiftBudget={handleShiftBudget}
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/projects"
          className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-center justify-between hover:border-[#444] transition-colors"
        >
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#666]">Projects</p>
            <p className="text-lg font-bold mt-0.5">{projects.length}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#444]">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
        <Link
          href="/expenses"
          className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-center justify-between hover:border-[#444] transition-colors"
        >
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#666]">Expenses</p>
            <p className="text-lg font-bold mt-0.5">{expenses.length}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#444]">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
