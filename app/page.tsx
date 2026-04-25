'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { cache, fromCache } from '@/lib/cache'
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

function parseSettings(rows: { key: string; value: string }[]): Settings {
  const s = { ...DEFAULT_SETTINGS }
  for (const r of rows) {
    if (r.key === 'starting_capital') s.starting_capital = parseFloat(r.value)
    if (r.key === 'monthly_overhead') s.monthly_overhead = parseFloat(r.value)
    if (r.key === 'weekly_ad_budget') s.weekly_ad_budget = parseFloat(r.value)
    if (r.key === 'currency_symbol') s.currency_symbol = r.value
    if (r.key === 'business_name') s.business_name = r.value
  }
  return s
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>(() => fromCache('projects', []))
  const [expenses, setExpenses] = useState<Expense[]>(() => fromCache('expenses', []))
  const [adSpend, setAdSpend] = useState<AdSpend[]>(() => fromCache('ad_spend', []))
  const [settings, setSettings] = useState<Settings>(() => fromCache('settings_parsed', DEFAULT_SETTINGS))
  const [syncing, setSyncing] = useState(false)
  // Only show skeleton when truly no cached data at all
  const hasCached = projects.length > 0 || expenses.length > 0
  const [loading, setLoading] = useState(!hasCached)
  const didMount = useRef(false)

  const serverSync = useCallback(async () => {
    setSyncing(true)
    const [{ data: proj }, { data: exp }, { data: ads }, { data: sett }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('ad_spend').select('*').eq('week_start', getWeekStart()),
      supabase.from('settings').select('*'),
    ])
    setSyncing(false)
    if (proj) { setProjects(proj as Project[]); cache.set('projects', proj) }
    if (exp) { setExpenses(exp as Expense[]); cache.set('expenses', exp) }
    if (ads) { setAdSpend(ads as AdSpend[]); cache.set('ad_spend', ads) }
    if (sett) {
      const parsed = parseSettings(sett as { key: string; value: string }[])
      setSettings(parsed)
      cache.set('settings_parsed', parsed)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (didMount.current) return
    didMount.current = true
    serverSync()

    const ch = supabase
      .channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, serverSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, serverSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_spend' }, serverSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, serverSync)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [serverSync])

  async function handleLogSpend(platform: string, amount: number) {
    const week = getWeekStart()
    const existing = adSpend.find(a => a.platform === platform)
    if (existing) {
      await supabase.from('ad_spend').update({ spent: existing.spent + amount }).eq('id', existing.id)
    } else {
      await supabase.from('ad_spend').insert({
        platform, week_start: week,
        budget: platform === 'Meta Ads' ? 1000 : 500,
        spent: amount,
      })
    }
    serverSync()
  }

  async function handleShiftBudget(from: string, to: string, amount: number) {
    const fromRow = adSpend.find(a => a.platform === from)
    const toRow = adSpend.find(a => a.platform === to)
    if (!fromRow || !toRow) return
    await Promise.all([
      supabase.from('ad_spend').update({ budget: fromRow.budget - amount }).eq('id', fromRow.id),
      supabase.from('ad_spend').update({ budget: toRow.budget + amount }).eq('id', toRow.id),
    ])
    serverSync()
  }

  const overall = calcDashboard(projects, expenses, settings)
  const monthly = calcMonthlyMetrics(projects, expenses, settings)

  const breakEvenPct = monthly.totalCosts > 0
    ? Math.min((monthly.revenue / monthly.totalCosts) * 100, 100)
    : 0

  const weekAdSpent = adSpend.reduce((s, a) => s + a.spent, 0)
  const weekAdBudget = adSpend.reduce((s, a) => s + a.budget, 0)
  const weekAdRemaining = weekAdBudget - weekAdSpent
  const runwayWarn = overall.runway < 2 && isFinite(overall.runway)

  if (loading) {
    return (
      <div className="px-4 pt-6 pb-28 max-w-md mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="bg-[#111] rounded-lg h-8 w-32 animate-pulse" />
          <div className="bg-[#111] rounded-lg h-8 w-8 animate-pulse" />
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-[#111] rounded-2xl h-24 mb-3 animate-pulse border border-[#1a1a1a]" />
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-28 max-w-md mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{settings.business_name}</h1>
            {syncing && (
              <div className="w-1.5 h-1.5 bg-[#444] rounded-full animate-pulse" />
            )}
          </div>
          <p className="text-sm text-[#555]">{monthly.monthName}</p>
        </div>
        <Link href="/settings" className="w-10 h-10 flex items-center justify-center text-[#444] hover:text-white rounded-xl transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      {/* ── THIS MONTH ─────────────────────────────────────────────────── */}
      <Label>This Month</Label>

      {/* Net profit hero */}
      <div className={`rounded-2xl p-5 mb-3 ${monthly.netProfit >= 0 ? 'bg-white' : 'bg-[#111] border border-[#222]'}`}>
        <p className={`text-xs uppercase tracking-widest mb-1 ${monthly.netProfit >= 0 ? 'text-black/40' : 'text-[#555]'}`}>
          Net Profit
        </p>
        <p className={`text-4xl font-bold tracking-tight ${monthly.netProfit >= 0 ? 'text-black' : 'text-white'}`}>
          {monthly.netProfit < 0 ? '−' : ''}{formatINR(Math.abs(monthly.netProfit))}
        </p>
        <p className={`text-sm mt-1 ${monthly.netProfit >= 0 ? 'text-black/50' : 'text-[#555]'}`}>
          {formatPercent(monthly.margin)} margin
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card label="Made This Month">
          <p className="text-2xl font-bold">{formatINR(monthly.revenue)}</p>
          {monthly.pendingRevenue > 0 && (
            <p className="text-xs text-[#555] mt-1">+{formatINR(monthly.pendingRevenue)} pending</p>
          )}
        </Card>
        <Card label="Spent This Month">
          <p className="text-2xl font-bold">{formatINR(monthly.expenses)}</p>
          <p className="text-xs text-[#555] mt-1">+{formatINR(settings.monthly_overhead)} overhead</p>
        </Card>
      </div>

      {/* ── BREAK-EVEN ─────────────────────────────────────────────────── */}
      <Label>To Break Even</Label>
      <div className="bg-[#111] border border-[#222] rounded-2xl p-4 mb-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#666]">Revenue</span>
          <span className="font-bold">{formatINR(monthly.revenue)}</span>
        </div>
        <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${breakEvenPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-[#555] mb-3">
          <span>0</span>
          <span>Need {formatINR(monthly.totalCosts)}</span>
        </div>
        {monthly.netProfit >= 0 ? (
          <p className="text-sm font-bold text-white">Profitable — {formatINR(monthly.profitSurplus)} above break-even</p>
        ) : (
          <p className="text-sm text-[#888]">
            Need <span className="text-white font-bold">{formatINR(monthly.breakEvenGap)}</span> more to profit ({breakEvenPct.toFixed(0)}% there)
          </p>
        )}
        {monthly.pendingRevenue > 0 && monthly.netProfit < 0 && (
          <p className="text-xs text-[#555] mt-2 italic border-t border-[#1a1a1a] pt-2">
            Close pending projects →{' '}
            {monthly.pendingImpact >= 0
              ? `profit by ${formatINR(monthly.pendingImpact)}`
              : `gap shrinks to ${formatINR(Math.abs(monthly.pendingImpact))}`}
          </p>
        )}
      </div>

      {/* ── AD SPEND ───────────────────────────────────────────────────── */}
      <Label>Ad Spend This Week</Label>
      <AdBudgetCard
        adSpend={adSpend}
        weeklyCapTotal={settings.weekly_ad_budget}
        onLogSpend={handleLogSpend}
        onShiftBudget={handleShiftBudget}
      />
      <div className="grid grid-cols-3 gap-2 mt-2 mb-5">
        <MiniCard label="Budget" value={formatINR(weekAdBudget)} />
        <MiniCard label="Spent" value={formatINR(weekAdSpent)} />
        <MiniCard
          label="Left"
          value={(weekAdRemaining < 0 ? '−' : '') + formatINR(Math.abs(weekAdRemaining))}
          alert={weekAdRemaining < 0}
        />
      </div>

      {/* ── LATEST PROJECT ─────────────────────────────────────────────── */}
      {monthly.latestProject && (
        <>
          <Label>Latest Project</Label>
          <Link href="/projects" className="block">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 mb-5 active:border-white transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{monthly.latestProject.name}</p>
                  <p className="text-2xl font-bold mt-1">{formatINR(monthly.latestProject.amount)}</p>
                  <p className="text-xs text-[#555] mt-1">{monthly.latestProject.date}</p>
                </div>
                <span className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wide ${
                  monthly.latestProject.status === 'Paid' ? 'bg-white text-black' :
                  monthly.latestProject.status === 'Confirmed' ? 'border border-white text-white' :
                  'border border-[#333] text-[#666]'
                }`}>
                  {monthly.latestProject.status}
                </span>
              </div>
              <p className="text-xs text-[#444] mt-2">
                {monthly.projectCount} total project{monthly.projectCount !== 1 ? 's' : ''}
              </p>
            </div>
          </Link>
        </>
      )}

      {/* ── AGENCY BENCHMARK ───────────────────────────────────────────── */}
      <Label>vs Industry</Label>
      <div className="bg-[#111] border border-[#222] rounded-2xl p-4 mb-5">
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-xs text-[#555] mb-0.5">Your margin</p>
            <p className="text-3xl font-bold">
              {monthly.margin < 0 ? '−' : ''}{Math.abs(monthly.margin).toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#555] mb-0.5">Industry avg</p>
            <p className="text-3xl font-bold">25%</p>
          </div>
        </div>

        <div className="h-2.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-white rounded-full"
            style={{ width: `${Math.max(2, Math.min(((monthly.margin + 30) / 55) * 100, 100))}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[#444] mb-3">
          <span>−30%</span>
          <span>25% target</span>
        </div>

        {monthly.margin >= 25 ? (
          <p className="text-sm font-bold text-white">
            Beating industry by {formatPercent(monthly.margin - 25)}
          </p>
        ) : (
          <p className="text-sm text-[#888]">
            Need {formatINR(Math.max(0, monthly.revenueToHitBenchmark - monthly.revenue))} more revenue to hit 25%
          </p>
        )}

        {/* ₹25k milestone */}
        <div className="mt-4 pt-3 border-t border-[#1a1a1a]">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[#555]">₹25k/month milestone</span>
            <span className="font-bold">{((monthly.revenue / 25000) * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${Math.min((monthly.revenue / 25000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[#444] mt-1">
            {monthly.revenue >= 25000 ? 'Milestone cleared' : `${formatINR(25000 - monthly.revenue)} away`}
          </p>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1a1a1a] flex justify-between text-sm">
          <span className="text-[#555]">Active projects</span>
          <span className="font-bold">{monthly.activeProjectCount} {monthly.activeProjectCount >= 2 ? '— ahead of avg' : '— build pipeline'}</span>
        </div>
      </div>

      {/* ── INSIGHTS ───────────────────────────────────────────────────── */}
      <Label>Insights</Label>
      <div className="flex flex-col gap-2.5 mb-5">
        {monthly.insights.map((ins, i) => (
          <div key={i} className={`rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 ${ins.positive ? 'border-white/20 bg-white/5' : 'border-[#222] bg-[#111]'}`}>
            <p className="text-sm text-[#bbb] leading-snug flex-1">{ins.label}</p>
            {ins.positive && <span className="text-white font-bold text-base shrink-0">✓</span>}
          </div>
        ))}

        {monthly.revenue > 0 && monthly.expenses > 0 && (
          <div className="border border-[#222] bg-[#111] rounded-2xl px-4 py-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-[#888]">Cost per ₹1 earned</p>
              <p className="text-base font-bold">₹{(monthly.expenses / monthly.revenue).toFixed(2)}</p>
            </div>
            <p className="text-xs text-[#444] mt-1">Healthy agencies keep this under ₹0.60</p>
          </div>
        )}
      </div>

      {/* ── OVERALL ────────────────────────────────────────────────────── */}
      <Label>Overall</Label>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Card label="Capital Left">
          <p className="text-2xl font-bold">{formatINR(Math.abs(overall.capitalRemaining))}</p>
          {overall.capitalRemaining < 0 && <p className="text-xs text-[#888] mt-1">overspent</p>}
        </Card>
        <Card label="Runway" alert={runwayWarn}>
          <p className="text-2xl font-bold">{formatMonths(overall.runway)}</p>
          {runwayWarn && <p className="text-xs text-[#888] mt-1 italic">add revenue</p>}
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Card label="Total Revenue"><p className="text-2xl font-bold">{formatINR(overall.totalRevenue)}</p></Card>
        <Card label="Total Expenses"><p className="text-2xl font-bold">{formatINR(overall.totalExpenses)}</p></Card>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-widest text-[#444] mb-3">{children}</p>
}

function Card({ label, children, alert }: { label: string; children: React.ReactNode; alert?: boolean }) {
  return (
    <div className={`bg-[#111] rounded-2xl p-4 border ${alert ? 'border-white' : 'border-[#222]'}`}>
      <p className="text-xs uppercase tracking-widest text-[#555] mb-2">{label}</p>
      {children}
    </div>
  )
}

function MiniCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`bg-[#111] rounded-xl p-3 border text-center ${alert ? 'border-white' : 'border-[#222]'}`}>
      <p className="text-[10px] uppercase tracking-widest text-[#555] mb-1">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  )
}
