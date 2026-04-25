'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  calcDashboard,
  calcMonthlyMetrics,
  formatINR,
  formatPercent,
  formatMonths,
  getWeekStart,
} from '@/lib/calculations'
import type { Project, Expense, AdSpend, Settings } from '@/types'
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
    for (const row of (sett ?? [])) {
      if (row.key === 'starting_capital') s.starting_capital = parseFloat(row.value)
      if (row.key === 'monthly_overhead') s.monthly_overhead = parseFloat(row.value)
      if (row.key === 'weekly_ad_budget') s.weekly_ad_budget = parseFloat(row.value)
      if (row.key === 'currency_symbol') s.currency_symbol = row.value
      if (row.key === 'business_name') s.business_name = row.value
    }
    setProjects(p); setExpenses(e); setAdSpend(a); setSettings(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
    const ch = supabase
      .channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_spend' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadAll])

  async function handleLogSpend(platform: string, amount: number) {
    const week = getWeekStart()
    const existing = adSpend.find((a) => a.platform === platform)
    if (existing) {
      await supabase.from('ad_spend').update({ spent: existing.spent + amount }).eq('id', existing.id)
    } else {
      await supabase.from('ad_spend').insert({
        platform,
        week_start: week,
        budget: platform === 'Meta Ads' ? 1000 : 500,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-6 h-6 border border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const overall = calcDashboard(projects, expenses, settings)
  const monthly = calcMonthlyMetrics(projects, expenses, settings)
  const runwayWarn = overall.runway < 2 && isFinite(overall.runway)

  const breakEvenPct = monthly.totalCosts > 0
    ? Math.min((monthly.revenue / monthly.totalCosts) * 100, 100)
    : 0

  const benchmarkPct = Math.max(0, Math.min(
    ((monthly.margin + 30) / (monthly.benchmarkMargin + 30)) * 100,
    100
  ))

  const weekAdSpent = adSpend.reduce((s, a) => s + a.spent, 0)
  const weekAdBudget = adSpend.reduce((s, a) => s + a.budget, 0)
  const weekAdRemaining = weekAdBudget - weekAdSpent

  return (
    <div className="px-4 pt-5 pb-32 max-w-md mx-auto">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{settings.business_name}</h1>
          <p className="text-xs text-[#555] mt-0.5">{monthly.monthName}</p>
        </div>
        <Link href="/settings" className="text-[#444] hover:text-white p-1 transition-colors">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      {/* ─── THIS MONTH ─────────────────────────────────────────────────── */}
      <SectionLabel>This Month</SectionLabel>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <SmallCard label="Made">
          <p className="text-xl font-bold">{formatINR(monthly.revenue)}</p>
          {monthly.pendingRevenue > 0 && (
            <p className="text-[11px] text-[#555] mt-0.5">
              +{formatINR(monthly.pendingRevenue)} <span className="italic">unconfirmed</span>
            </p>
          )}
        </SmallCard>
        <SmallCard label="Spent">
          <p className="text-xl font-bold">{formatINR(monthly.expenses)}</p>
          <p className="text-[11px] text-[#555] mt-0.5">
            +{formatINR(settings.monthly_overhead)} overhead
          </p>
        </SmallCard>
      </div>

      {/* Net profit — full-width hero card */}
      <div className={`rounded-xl p-4 mb-5 border ${monthly.netProfit >= 0 ? 'bg-white border-white' : 'bg-[#111] border-[#222]'}`}>
        <p className={`text-[11px] uppercase tracking-widest mb-1 ${monthly.netProfit >= 0 ? 'text-black/50' : 'text-[#666]'}`}>
          Net Profit — {monthly.monthName}
        </p>
        <p className={`text-3xl font-bold tracking-tight ${monthly.netProfit >= 0 ? 'text-black' : 'text-white'}`}>
          {monthly.netProfit < 0 ? '−' : ''}{formatINR(Math.abs(monthly.netProfit))}
        </p>
        <p className={`text-xs mt-1 ${monthly.netProfit >= 0 ? 'text-black/60' : 'text-[#555]'}`}>
          {formatPercent(monthly.margin)} margin
          {monthly.margin < 0 ? ' — below break-even' : monthly.margin < 20 ? ' — building toward 20%' : ' — solid'}
        </p>
      </div>

      {/* ─── BREAK-EVEN TRACKER ─────────────────────────────────────────── */}
      <SectionLabel>Break-even This Month</SectionLabel>
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 mb-5">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-[#666]">Revenue</p>
            <p className="text-base font-bold">{formatINR(monthly.revenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#666]">Need to Break Even</p>
            <p className="text-base font-bold">{formatINR(monthly.totalCosts)}</p>
          </div>
        </div>
        <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${breakEvenPct}%` }}
          />
        </div>
        <p className="text-xs">
          {monthly.netProfit >= 0 ? (
            <span className="text-white font-bold">
              Profitable — {formatINR(monthly.profitSurplus)} above break-even
            </span>
          ) : (
            <span className="text-[#888]">
              {formatINR(monthly.breakEvenGap)} more to break even ({breakEvenPct.toFixed(0)}% there)
            </span>
          )}
        </p>
        {monthly.pendingRevenue > 0 && monthly.netProfit < 0 && (
          <p className="text-[11px] text-[#555] mt-1 italic">
            Converting pending projects would{' '}
            {monthly.pendingImpact >= 0
              ? `make you profitable by ${formatINR(monthly.pendingImpact)}`
              : `reduce the gap to ${formatINR(Math.abs(monthly.pendingImpact))}`}
          </p>
        )}
      </div>

      {/* ─── AD SPEND ───────────────────────────────────────────────────── */}
      <SectionLabel>Ad Spend</SectionLabel>
      <div className="mb-2">
        <AdBudgetCard
          adSpend={adSpend}
          weeklyCapTotal={settings.weekly_ad_budget}
          onLogSpend={handleLogSpend}
          onShiftBudget={handleShiftBudget}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5">
        <MiniStat label="Week Budget" value={formatINR(weekAdBudget)} />
        <MiniStat label="Week Spent" value={formatINR(weekAdSpent)} />
        <MiniStat
          label="Remaining"
          value={formatINR(Math.abs(weekAdRemaining))}
          warn={weekAdRemaining < 0}
          prefix={weekAdRemaining < 0 ? '−' : ''}
        />
      </div>

      {/* ─── LATEST PROJECT ─────────────────────────────────────────────── */}
      {monthly.latestProject && (
        <>
          <SectionLabel>Latest Project</SectionLabel>
          <Link href="/projects">
            <div className="bg-[#111] border border-[#222] rounded-xl p-4 mb-5 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{monthly.latestProject.name}</p>
                <p className="text-xl font-bold mt-0.5">{formatINR(monthly.latestProject.amount)}</p>
                <p className="text-[11px] text-[#555] mt-0.5">{monthly.latestProject.date}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  monthly.latestProject.status === 'Paid'
                    ? 'bg-white text-black'
                    : monthly.latestProject.status === 'Confirmed'
                    ? 'border border-white text-white'
                    : 'border border-[#444] text-[#888]'
                }`}>
                  {monthly.latestProject.status}
                </span>
                <p className="text-[10px] text-[#444]">
                  {monthly.projectCount} total project{monthly.projectCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </Link>
        </>
      )}

      {/* ─── AGENCY BENCHMARK ───────────────────────────────────────────── */}
      <SectionLabel>Agency Benchmark</SectionLabel>
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 mb-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#666]">Your Margin</p>
            <p className={`text-2xl font-bold ${monthly.margin >= 20 ? 'text-white' : 'text-white'}`}>
              {monthly.margin < 0 ? '−' : ''}{Math.abs(monthly.margin).toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-[#666]">Industry Avg</p>
            <p className="text-2xl font-bold text-white">{monthly.benchmarkMargin}%</p>
          </div>
        </div>

        {/* Margin gauge — -30% to +30% normalized */}
        <div className="relative h-2 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
          {/* Benchmark marker at right */}
          <div className="absolute right-0 top-0 h-full w-0.5 bg-[#444] z-10" />
          <div
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${Math.max(2, benchmarkPct)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[#444] mb-3">
          <span>loss</span>
          <span>25% target</span>
        </div>

        {monthly.margin >= monthly.benchmarkMargin ? (
          <p className="text-xs text-white font-bold">
            You are beating the industry benchmark by {formatPercent(monthly.margin - monthly.benchmarkMargin)}
          </p>
        ) : (
          <p className="text-xs text-[#888]">
            {formatINR(Math.max(0, monthly.revenueToHitBenchmark - monthly.revenue))} more revenue needed to hit {monthly.benchmarkMargin}% margin
          </p>
        )}

        {/* Revenue goal progress */}
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-[#666]">₹25k/month milestone</p>
            <p className="text-[11px] font-bold">
              {formatINR(monthly.revenue)} / ₹25,000
            </p>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${Math.min((monthly.revenue / 25000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-[#444] mt-1 italic">
            {monthly.revenue >= 25000
              ? 'Milestone achieved this month'
              : `${((monthly.revenue / 25000) * 100).toFixed(0)}% of typical stable-agency monthly revenue`}
          </p>
        </div>

        {/* Active project count vs industry */}
        <div className="mt-3 pt-3 border-t border-[#1a1a1a] flex items-center justify-between">
          <p className="text-[11px] text-[#666]">Active projects</p>
          <p className="text-[11px]">
            <span className="font-bold text-white">{monthly.activeProjectCount}</span>
            <span className="text-[#555]"> — {monthly.activeProjectCount >= 2 ? 'above' : 'at'} typical for month 1</span>
          </p>
        </div>
      </div>

      {/* ─── SMART INSIGHTS ─────────────────────────────────────────────── */}
      <SectionLabel>Insights</SectionLabel>
      <div className="flex flex-col gap-2 mb-5">
        {monthly.insights.map((insight, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-3 border flex items-start justify-between gap-3 ${
              insight.positive
                ? 'border-white bg-[#0d0d0d]'
                : 'border-[#222] bg-[#111]'
            }`}
          >
            <p className="text-xs text-[#aaa] leading-relaxed flex-1">{insight.label}</p>
            {insight.positive && (
              <span className="text-[10px] font-bold text-white mt-0.5 shrink-0">✓</span>
            )}
          </div>
        ))}

        {/* How much to improve ratio insight */}
        {monthly.revenue > 0 && monthly.expenses > 0 && (
          <div className="border border-[#222] bg-[#111] rounded-xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-[#555] mb-1">Expense / Revenue Ratio</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#888]">
                Every ₹1 earned costs {(monthly.expenses / monthly.revenue).toFixed(2)} in expenses
              </p>
              <p className="text-sm font-bold">
                {((monthly.expenses / monthly.revenue) * 100).toFixed(0)}%
              </p>
            </div>
            <p className="text-[10px] text-[#444] mt-1 italic">
              Aim for under 60% — healthy agencies keep this ratio low
            </p>
          </div>
        )}
      </div>

      {/* ─── CAPITAL & RUNWAY ────────────────────────────────────────────── */}
      <SectionLabel>Overall Health</SectionLabel>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <SmallCard label="Capital Left">
          <p className="text-xl font-bold">{formatINR(Math.abs(overall.capitalRemaining))}</p>
          {overall.capitalRemaining < 0 && <p className="text-[11px] text-[#888] mt-0.5">overspent</p>}
        </SmallCard>
        <SmallCard label="Runway" warn={runwayWarn}>
          <p className="text-xl font-bold">{formatMonths(overall.runway)}</p>
          {runwayWarn && <p className="text-[11px] text-[#999] italic mt-0.5">bring in revenue</p>}
        </SmallCard>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <SmallCard label="All-time Revenue">
          <p className="text-xl font-bold">{formatINR(overall.totalRevenue)}</p>
        </SmallCard>
        <SmallCard label="All-time Expenses">
          <p className="text-xl font-bold">{formatINR(overall.totalExpenses)}</p>
        </SmallCard>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-widest text-[#444] mb-2">{children}</p>
  )
}

function SmallCard({
  label,
  children,
  warn,
}: {
  label: string
  children: React.ReactNode
  warn?: boolean
}) {
  return (
    <div className={`bg-[#111] rounded-xl p-4 border ${warn ? 'border-white' : 'border-[#222]'}`}>
      <p className="text-[11px] uppercase tracking-widest text-[#666] mb-1">{label}</p>
      {children}
    </div>
  )
}

function MiniStat({
  label,
  value,
  warn,
  prefix = '',
}: {
  label: string
  value: string
  warn?: boolean
  prefix?: string
}) {
  return (
    <div className={`bg-[#111] rounded-xl p-3 border text-center ${warn ? 'border-white' : 'border-[#222]'}`}>
      <p className="text-[9px] uppercase tracking-widest text-[#555] mb-1">{label}</p>
      <p className="text-sm font-bold leading-none">
        {prefix}{value}
      </p>
    </div>
  )
}
