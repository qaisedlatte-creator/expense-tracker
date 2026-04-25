'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatINR } from '@/lib/calculations'

interface ExpenseRow {
  id: string
  name: string
  amount: string
}

export default function CalculatorPage() {
  const [revenue, setRevenue] = useState('')
  const [rows, setRows] = useState<ExpenseRow[]>([{ id: '1', name: '', amount: '' }])
  const [overheadManual, setOverheadManual] = useState('')
  const [overrideOverhead, setOverrideOverhead] = useState(false)
  const [activeProjects, setActiveProjects] = useState(1)
  const [monthlyOverhead, setMonthlyOverhead] = useState(2000)

  const load = useCallback(async () => {
    const [{ data: proj }, { data: sett }] = await Promise.all([
      supabase.from('projects').select('status').in('status', ['Confirmed', 'Pending']),
      supabase.from('settings').select('*').in('key', ['monthly_overhead']),
    ])
    if (proj) setActiveProjects(Math.max(proj.length, 1))
    if (sett) {
      const oh = sett.find((s) => s.key === 'monthly_overhead')
      if (oh) setMonthlyOverhead(parseFloat(oh.value))
    }
  }, [])

  useEffect(() => { load() }, [load])

  function addRow() {
    setRows([...rows, { id: Date.now().toString(), name: '', amount: '' }])
  }

  function removeRow(id: string) {
    setRows(rows.filter((r) => r.id !== id))
  }

  function updateRow(id: string, field: 'name' | 'amount', val: string) {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const rev = parseFloat(revenue) || 0
  const totalExpenses = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const autoOverhead = monthlyOverhead / activeProjects
  const overhead = overrideOverhead ? (parseFloat(overheadManual) || 0) : autoOverhead
  const netProfit = rev - totalExpenses - overhead
  const profitMargin = rev > 0 ? (netProfit / rev) * 100 : 0
  const breakEven = totalExpenses + overhead

  return (
    <div className="px-4 pt-6 pb-32 max-w-md mx-auto">
      <h1 className="text-xl font-bold tracking-tight mb-1">Profit Calculator</h1>
      <p className="text-xs text-[#555] mb-6">One-time project estimate</p>

      {/* Revenue */}
      <div className="mb-5">
        <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">
          Project Revenue (₹)
        </label>
        <input
          type="number"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
          placeholder="0"
          className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-xl font-bold text-white placeholder-[#333] focus:outline-none focus:border-white"
        />
      </div>

      {/* Expenses */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] uppercase tracking-widest text-[#666]">
            Project Expenses
          </label>
          <button
            onClick={addRow}
            className="text-[10px] text-[#666] border border-[#333] px-2.5 py-1 rounded hover:border-white hover:text-white transition-colors"
          >
            + Add row
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex gap-2">
              <input
                type="text"
                value={row.name}
                onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                placeholder="Expense name"
                className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
              />
              <input
                type="number"
                value={row.amount}
                onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                placeholder="₹0"
                className="w-24 bg-[#111] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
              />
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-[#444] hover:text-white transition-colors px-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Overhead */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] uppercase tracking-widest text-[#666]">
            Overhead Share
          </label>
          <button
            onClick={() => setOverrideOverhead((v) => !v)}
            className="text-[10px] text-[#555] border border-[#2a2a2a] px-2.5 py-1 rounded"
          >
            {overrideOverhead ? 'Auto' : 'Override'}
          </button>
        </div>
        {overrideOverhead ? (
          <input
            type="number"
            value={overheadManual}
            onChange={(e) => setOverheadManual(e.target.value)}
            placeholder={String(Math.round(autoOverhead))}
            className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
          />
        ) : (
          <div className="bg-[#111] border border-[#222] rounded-lg px-3 py-2.5 flex items-center justify-between">
            <span className="text-sm text-white">{formatINR(autoOverhead)}</span>
            <span className="text-[11px] text-[#555]">
              {formatINR(monthlyOverhead)} ÷ {activeProjects} project{activeProjects !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex justify-between">
          <span className="text-xs text-[#666]">Gross Revenue</span>
          <span className="text-sm font-bold">{formatINR(rev)}</span>
        </div>
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex justify-between">
          <span className="text-xs text-[#666]">Project Expenses</span>
          <span className="text-sm font-bold text-white">−{formatINR(totalExpenses)}</span>
        </div>
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex justify-between">
          <span className="text-xs text-[#666]">Overhead Share</span>
          <span className="text-sm font-bold text-white">−{formatINR(overhead)}</span>
        </div>
        <div className={`px-4 py-4 flex justify-between items-center ${netProfit < 0 ? 'bg-[#0a0a0a]' : ''}`}>
          <div>
            <span className="text-xs text-[#666] uppercase tracking-widest block">Net Profit</span>
            <span className="text-[11px] text-[#555]">
              {profitMargin >= 0 ? profitMargin.toFixed(1) : '−' + Math.abs(profitMargin).toFixed(1)}% margin
            </span>
          </div>
          <span className={`text-2xl font-bold ${netProfit < 0 ? '' : ''}`}>
            {netProfit < 0 ? '−' : ''}{formatINR(Math.abs(netProfit))}
          </span>
        </div>
      </div>

      {/* Break-even */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 mb-4">
        <p className="text-[11px] uppercase tracking-widest text-[#666] mb-1">Break-even Point</p>
        <p className="text-lg font-bold">{formatINR(breakEven)}</p>
        <p className="text-xs text-[#555] mt-0.5">Minimum revenue to not lose money</p>
      </div>

      {/* Overhead rule */}
      <div className="border border-[#222] rounded-xl p-4">
        <p className="text-xs text-[#555] italic">
          You need at least {formatINR(monthlyOverhead)} to cover overhead this month
          {activeProjects > 1 && ` (split across ${activeProjects} active projects)`}.
        </p>
      </div>
    </div>
  )
}
