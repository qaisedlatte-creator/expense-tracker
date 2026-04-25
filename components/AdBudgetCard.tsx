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

  const totalSpent = adSpend.reduce((s, a) => s + a.spent, 0)
  const totalBudget = adSpend.reduce((s, a) => s + a.budget, 0)
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

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
    <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="text-left">
          <p className="text-[11px] uppercase tracking-widest text-[#666]">Ad Budget — This Week</p>
          <p className="font-bold text-sm mt-0.5">
            {formatINR(totalSpent)} <span className="text-[#555] font-normal">/ {formatINR(totalBudget)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overallPct >= 80 && (
            <span className="text-[10px] italic text-[#999] border border-[#444] px-2 py-0.5 rounded">over 80%</span>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round"
            className={`text-[#555] transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1 bg-[#222] rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${Math.min(overallPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Rule */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-[#444] italic">
          Weekly cap {formatINR(weeklyCapTotal)} — no top-ups mid-week
        </p>
      </div>

      {/* Expanded rows */}
      {expanded && (
        <div className="border-t border-[#222]">
          {platforms.map((platform) => {
            const row = getRow(platform)
            const spent = row?.spent ?? 0
            const budget = row?.budget ?? 0
            const pct = budget > 0 ? (spent / budget) * 100 : 0
            const remaining = budget - spent
            const warn = pct >= 80

            const other = platforms.find((p) => p !== platform)!
            const otherRow = getRow(other)
            const otherUnspent = (otherRow?.budget ?? 0) - (otherRow?.spent ?? 0)

            return (
              <div key={platform} className={`px-4 py-3 border-b border-[#1a1a1a] ${warn ? 'border-l-2 border-l-white' : ''}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold">{platform}</p>
                  <p className="text-xs text-[#666]">
                    {formatINR(spent)} / {formatINR(budget)}
                    {remaining < 0
                      ? <span className="text-white font-bold ml-1">(over by {formatINR(Math.abs(remaining))})</span>
                      : <span className="text-[#555] ml-1">({formatINR(remaining)} left)</span>
                    }
                  </p>
                </div>

                <div className="h-1.5 bg-[#222] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {logging === platform ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        value={logAmount}
                        onChange={(e) => setLogAmount(e.target.value)}
                        placeholder="₹ amount"
                        className="flex-1 bg-black border border-[#333] rounded px-2 py-1 text-xs text-white placeholder-[#444] focus:outline-none focus:border-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleLog(platform)}
                        disabled={loading}
                        className="text-xs bg-white text-black px-3 py-1 rounded font-bold disabled:opacity-50"
                      >
                        Log
                      </button>
                      <button
                        onClick={() => { setLogging(null); setLogAmount('') }}
                        className="text-xs text-[#555] px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setLogging(platform)}
                        className="text-[10px] border border-[#333] text-[#888] px-2.5 py-1 rounded hover:border-white hover:text-white transition-colors"
                      >
                        + Log Spend
                      </button>
                      {otherUnspent > 0 && remaining > 0 && (
                        <button
                          onClick={() => handleShift(other, platform)}
                          disabled={loading}
                          className="text-[10px] border border-[#333] text-[#888] px-2.5 py-1 rounded hover:border-white hover:text-white transition-colors disabled:opacity-50"
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
