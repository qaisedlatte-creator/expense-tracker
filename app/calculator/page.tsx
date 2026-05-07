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
  const [revenue,        setRevenue]        = useState('')
  const [rows,           setRows]           = useState<ExpenseRow[]>([{ id: '1', name: '', amount: '' }])
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

  function addRow()                                     { setRows([...rows, { id: Date.now().toString(), name: '', amount: '' }]) }
  function removeRow(id: string)                        { setRows(rows.filter(r => r.id !== id)) }
  function updateRow(id: string, f: 'name' | 'amount', v: string) {
    setRows(rows.map(r => r.id === id ? { ...r, [f]: v } : r))
  }

  const rev           = parseFloat(revenue) || 0
  const totalExpenses = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const autoOverhead  = monthlyOverhead / activeProjects
  const overhead      = overrideOverhead ? (parseFloat(overheadManual) || 0) : autoOverhead
  const netProfit     = rev - totalExpenses - overhead
  const profitMargin  = rev > 0 ? (netProfit / rev) * 100 : 0
  const breakEven     = totalExpenses + overhead

  const inputStyle = {
    background:   'rgb(var(--bg))',
    border:       '1px solid var(--bdr)',
    color:        'var(--tx)',
  }
  const inputFocusClass = 'focus:outline-none focus:ring-1 focus:ring-[rgb(var(--ac))]'

  return (
    <div className="px-4 pt-6 pb-32 max-w-md mx-auto">
      <h1 className="text-xl font-bold tracking-tight text-tx mb-1">Profit Calculator</h1>
      <p className="text-xs text-t4 mb-6">One-time project estimate</p>

      {/* Revenue */}
      <div className="mb-5">
        <label className="text-[11px] uppercase tracking-widest text-t3 block mb-1.5">
          Project Revenue (₹)
        </label>
        <input
          type="number"
          value={revenue}
          onChange={e => setRevenue(e.target.value)}
          placeholder="0"
          className={`w-full rounded-xl px-4 py-3 text-xl font-bold text-tx placeholder-t6 ${inputFocusClass}`}
          style={inputStyle}
        />
      </div>

      {/* Expenses */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] uppercase tracking-widest text-t3">Project Expenses</label>
          <button
            onClick={addRow}
            className="text-[10px] text-t3 border border-bds px-2.5 py-1 rounded hover:border-ac hover:text-tx transition-colors"
          >
            + Add row
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(row => (
            <div key={row.id} className="flex gap-2">
              <input
                type="text"
                value={row.name}
                onChange={e => updateRow(row.id, 'name', e.target.value)}
                placeholder="Expense name"
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm placeholder-t5 ${inputFocusClass}`}
                style={inputStyle}
              />
              <input
                type="number"
                value={row.amount}
                onChange={e => updateRow(row.id, 'amount', e.target.value)}
                placeholder="₹0"
                className={`w-24 rounded-lg px-3 py-2.5 text-sm placeholder-t5 ${inputFocusClass}`}
                style={inputStyle}
              />
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-t5 hover:text-tx transition-colors px-1"
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
          <label className="text-[11px] uppercase tracking-widest text-t3">Overhead Share</label>
          <button
            onClick={() => setOverrideOverhead(v => !v)}
            className="text-[10px] text-t4 border border-bdh px-2.5 py-1 rounded"
          >
            {overrideOverhead ? 'Auto' : 'Override'}
          </button>
        </div>
        {overrideOverhead ? (
          <input
            type="number"
            value={overheadManual}
            onChange={e => setOverheadManual(e.target.value)}
            placeholder={String(Math.round(autoOverhead))}
            className={`w-full rounded-lg px-3 py-2.5 text-sm placeholder-t5 ${inputFocusClass}`}
            style={inputStyle}
          />
        ) : (
          <div className="bg-surface border border-bdr rounded-lg px-3 py-2.5 flex items-center justify-between">
            <span className="text-sm text-tx">{formatINR(autoOverhead)}</span>
            <span className="text-[11px] text-t4">
              {formatINR(monthlyOverhead)} ÷ {activeProjects} project{activeProjects !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-surface border border-bdr rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-bdf flex justify-between">
          <span className="text-xs text-t3">Gross Revenue</span>
          <span className="text-sm font-bold text-tx">{formatINR(rev)}</span>
        </div>
        <div className="px-4 py-3 border-b border-bdf flex justify-between">
          <span className="text-xs text-t3">Project Expenses</span>
          <span className="text-sm font-bold text-tx">−{formatINR(totalExpenses)}</span>
        </div>
        <div className="px-4 py-3 border-b border-bdf flex justify-between">
          <span className="text-xs text-t3">Overhead Share</span>
          <span className="text-sm font-bold text-tx">−{formatINR(overhead)}</span>
        </div>
        <div className={`px-4 py-4 flex justify-between items-center ${netProfit < 0 ? 'bg-sheet' : ''}`}>
          <div>
            <span className="text-xs text-t3 uppercase tracking-widest block">Net Profit</span>
            <span className="text-[11px] text-t4">
              {profitMargin >= 0 ? profitMargin.toFixed(1) : '−' + Math.abs(profitMargin).toFixed(1)}% margin
            </span>
          </div>
          <span className="text-2xl font-bold text-tx">
            {netProfit < 0 ? '−' : ''}{formatINR(Math.abs(netProfit))}
          </span>
        </div>
      </div>

      {/* Break-even */}
      <div className="bg-surface border border-bdr rounded-xl p-4 mb-4">
        <p className="text-[11px] uppercase tracking-widest text-t3 mb-1">Break-even Point</p>
        <p className="text-lg font-bold text-tx">{formatINR(breakEven)}</p>
        <p className="text-xs text-t4 mt-0.5">Minimum revenue to not lose money</p>
      </div>

      <div className="border border-bdr rounded-xl p-4">
        <p className="text-xs text-t4 italic">
          You need at least {formatINR(monthlyOverhead)} to cover overhead this month
          {activeProjects > 1 && ` (split across ${activeProjects} active projects)`}.
        </p>
      </div>
    </div>
  )
}
