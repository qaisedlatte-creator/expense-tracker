import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const [{ data: projects }, { data: expenses }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('amount,status,date,name'),
    supabase.from('expenses').select('amount,date,category'),
    supabase.from('settings').select('key,value'),
  ])

  const now      = new Date()
  const ym       = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const sym      = (settings?.find(s => s.key === 'currency_symbol')?.value) ?? '₹'
  const starting = parseFloat(settings?.find(s => s.key === 'starting_capital')?.value ?? '20000')
  const overhead = parseFloat(settings?.find(s => s.key === 'monthly_overhead')?.value ?? '2000')
  const name     = settings?.find(s => s.key === 'business_name')?.value ?? 'Webbes'

  const confirmedRevenue = (projects ?? [])
    .filter(p => p.status === 'Confirmed' || p.status === 'Paid')
    .reduce((s: number, p: { amount: number }) => s + p.amount, 0)

  const monthRevenue = (projects ?? [])
    .filter((p: { date: string; status: string }) => p.date.startsWith(ym) && (p.status === 'Confirmed' || p.status === 'Paid'))
    .reduce((s: number, p: { amount: number }) => s + p.amount, 0)

  const totalExpenses  = (expenses ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)
  const monthExpenses  = (expenses ?? []).filter((e: { date: string }) => e.date.startsWith(ym)).reduce((s: number, e: { amount: number }) => s + e.amount, 0)
  const netProfit      = confirmedRevenue - totalExpenses
  const monthProfit    = monthRevenue - monthExpenses - overhead
  const capitalLeft    = starting - totalExpenses
  const runway         = overhead > 0 ? capitalLeft / overhead : Infinity

  function fmt(n: number) {
    return `${sym}${Math.abs(n).toLocaleString('en-IN')}`
  }

  return NextResponse.json({
    business: name,
    month:    now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
    metrics: {
      monthRevenue:   { label: 'Made This Month',    value: fmt(monthRevenue),   raw: monthRevenue   },
      monthExpenses:  { label: 'Spent This Month',   value: fmt(monthExpenses),  raw: monthExpenses  },
      monthProfit:    { label: 'Net Profit',          value: fmt(monthProfit),    raw: monthProfit, sign: monthProfit >= 0 ? '+' : '-' },
      capitalLeft:    { label: 'Capital Remaining',   value: fmt(capitalLeft),    raw: capitalLeft    },
      runway:         { label: 'Runway (months)',     value: isFinite(runway) ? runway.toFixed(1) : '∞', raw: runway },
      allTimeRevenue: { label: 'All-time Revenue',    value: fmt(confirmedRevenue), raw: confirmedRevenue },
      netProfit:      { label: 'All-time Net Profit', value: fmt(netProfit),      raw: netProfit      },
    },
    updatedAt: now.toISOString(),
  })
}
