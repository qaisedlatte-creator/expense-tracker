'use client'

import { useState } from 'react'
import { formatINR } from '@/lib/calculations'
import type { AdSpend } from '@/types'

interface Props {
  adSpend: AdSpend[]
  weeklyCapTotal: number
  onLogSpend: (platform: string, amount: number) => Promise<void>
  onShiftBudget: (from: string, to: string, amount: number) => Promise<void>
}

export default function AdBudgetCard({ adSpend, weeklyCapTotal, onLogSpend, onShiftBudget }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [logging, setLogging] = useState<string | null>(null)
  const [logAmount, setLogAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const platforms = ['Meta Ads', 'Google Ads']

  const getRow = (platform: string): AdSpend | null =>
    adSpend.find((a) => a.platform === platform) ?? null

  const totalSpent  = adSpend.reduce((s, a) => s + a.spent,  0)
  const totalBudget = adSpend.reduce((s, a) => s + a.budget, 0)
  const overallPct  = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  async function handleLog(platform: string) {
    const amt = parseFloat(logAmount)
    if (!amt || amt <= 0) return
    setLoading(true)
    await onLogSpend(platform, amt)
    setLogging(null)
    setLogAmount('')
    setLoading(false)
  }

  async function handleShift(from: string, to: string) {
    const row = getRow(from)
    if (!row) return
    const unspent = row.budget - row.spent
    if (unspent <= 0) return
    setLoading(true)
    await onShiftBudget(from, to, unspent)
    setLoading(false)
  }

  return (
    <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="text-left">
          <p className="text-[11px] uppercase tracking-widest text-t3">Ad Budget — This Week</p>
          <p className="font-bold text-sm mt-0.5 text-tx">
            {formatINR(totalSpent)}{' '}
            <span className="text-t4 font-normal">/ {formatINR(totalBudget)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overallPct >= 80 && (
            <span className="text-[10px] italic text-t2 border border-bda px-2 py-0.5 rounded">over 80%</span>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round"
            className={`text-t4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Overall progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1 bg-bdr rounded-full overflow-hidden">
          <div
            className="h-full bg-ac rounded-full transition-all"
            style={{ width: `${Math.min(overallPct, 100)}%` }}
          />
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className="text-[10px] text-t5 italic">
          Weekly cap {formatINR(weeklyCapTotal)} — no top-ups mid-week
        </p>
      </div>

      {/* Expanded rows */}
      {expanded && (
        <div className="border-t border-bdr">
          {platforms.map((platform) => {
            const row = getRow(platform)
            const spent     = row?.spent  ?? 0
            const budget    = row?.budget ?? 0
            const pct       = budget > 0 ? (spent / budget) * 100 : 0
            const remaining = budget - spent
            const warn      = pct >= 80

            const other      = platforms.find((p) => p !== platform)!
            const otherRow   = getRow(other)
            const otherUnspent = (otherRow?.budget ?? 0) - (otherRow?.spent ?? 0)

            return (
              <div
                key={platform}
                className={`px-4 py-3 border-b border-bdf ${warn ? 'border-l-2 border-l-ac' : ''}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-tx">{platform}</p>
                  <p className="text-xs text-t3">
                    {formatINR(spent)} / {formatINR(budget)}
                    {remaining < 0
                      ? <span className="text-tx font-bold ml-1">(over by {formatINR(Math.abs(remaining))})</span>
                      : <span className="text-t4 ml-1">({formatINR(remaining)} left)</span>
                    }
                  </p>
                </div>

                <div className="h-1.5 bg-bdr rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-ac rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  {logging === platform ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        value={logAmount}
                        onChange={(e) => setLogAmount(e.target.value)}
                        placeholder="₹ amount"
                        className="flex-1 rounded px-2 py-1 text-xs focus:outline-none focus:border-ac"
                        style={{
                          background: 'rgb(var(--bg))',
                          border: '1px solid var(--bds)',
                          color: 'var(--tx)',
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleLog(platform)}
                        disabled={loading}
                        className="text-xs bg-ac text-acf px-3 py-1 rounded font-bold disabled:opacity-50"
                      >
                        Log
                      </button>
                      <button
                        onClick={() => { setLogging(null); setLogAmount('') }}
                        className="text-xs text-t4 px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setLogging(platform)}
                        className="text-[10px] border border-bds text-t2 px-2.5 py-1 rounded hover:border-ac hover:text-tx transition-colors"
                      >
                        + Log Spend
                      </button>
                      {otherUnspent > 0 && remaining > 0 && (
                        <button
                          onClick={() => handleShift(other, platform)}
                          disabled={loading}
                          className="text-[10px] border border-bds text-t2 px-2.5 py-1 rounded hover:border-ac hover:text-tx transition-colors disabled:opacity-50"
                        >
                          ← Shift {formatINR(otherUnspent)} from {other.split(' ')[0]}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
