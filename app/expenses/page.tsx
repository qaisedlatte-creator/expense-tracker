'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { cache, fromCache } from '@/lib/cache'
import { formatINR, categoryPercents } from '@/lib/calculations'
import type { Expense, ExpenseCategory, ExpenseType, Project } from '@/types'
import ExpenseRow from '@/components/ExpenseRow'
import BottomSheet from '@/components/BottomSheet'

const CATEGORIES: ExpenseCategory[] = ['Ads', 'Tools', 'Domain', 'Other']
const TYPES: ExpenseType[] = ['One-Time', 'Monthly', 'Variable']
const CACHE_KEY = 'expenses'
const PROJ_CACHE = 'projects'

const EMPTY_FORM = {
  name: '',
  category: 'Ads' as ExpenseCategory,
  platform: '',
  amount: '',
  type: 'One-Time' as ExpenseType,
  project_id: 'General',
  date: new Date().toISOString().split('T')[0],
  notes: '',
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>(() => fromCache<Expense[]>(CACHE_KEY, []))
  const [projects, setProjects] = useState<Project[]>(() => fromCache<Project[]>(PROJ_CACHE, []))
  const [loading, setLoading] = useState(expenses.length === 0)
  const [syncing, setSyncing] = useState(false)
  const [filterCat, setFilterCat] = useState<ExpenseCategory | 'All'>('All')
  const [filterProject, setFilterProject] = useState('All')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const didMount = useRef(false)

  function saveExpenses(updater: (prev: Expense[]) => Expense[]) {
    setExpenses(prev => {
      const next = updater(prev)
      cache.set(CACHE_KEY, next)
      return next
    })
  }

  async function serverSync() {
    setSyncing(true)
    const [{ data: exp, error: e1 }, { data: proj, error: e2 }] = await Promise.all([
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('projects').select('*').order('name'),
    ])
    setSyncing(false)
    if (!e1 && exp) {
      setExpenses(exp as Expense[])
      cache.set(CACHE_KEY, exp)
    }
    if (!e2 && proj) {
      setProjects(proj as Project[])
      cache.set(PROJ_CACHE, proj)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (didMount.current) return
    didMount.current = true
    serverSync()

    const ch = supabase
      .channel('expenses-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, (p) => {
        const row = p.new as Expense
        saveExpenses(prev => prev.some(x => x.id === row.id) ? prev : [row, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'expenses' }, (p) => {
        const row = p.new as Expense
        saveExpenses(prev => prev.map(x => x.id === row.id ? row : x))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'expenses' }, (p) => {
        saveExpenses(prev => prev.filter(x => x.id !== (p.old as Expense).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })
    setSheetOpen(true)
  }

  function openEdit(expense: Expense) {
    setEditing(expense)
    setForm({
      name: expense.name,
      category: expense.category,
      platform: expense.platform ?? '',
      amount: String(expense.amount),
      type: expense.type,
      project_id: expense.project_id ?? 'General',
      date: expense.date,
      notes: expense.notes ?? '',
    })
    setSheetOpen(true)
  }

  async function handleSave() {
    const name = form.name.trim()
    const amount = parseFloat(form.amount)
    if (!name || !amount) return

    const payload = {
      name,
      category: form.category,
      platform: form.platform.trim() || null,
      amount,
      type: form.type,
      project_id: form.project_id || 'General',
      date: form.date,
      notes: form.notes.trim() || null,
    }

    setSheetOpen(false)

    if (editing) {
      saveExpenses(prev => prev.map(e => e.id === editing.id ? { ...e, ...payload } : e))
      supabase.from('expenses').update(payload).eq('id', editing.id).then(() => serverSync())
    } else {
      const tempId = `tmp_${Date.now()}`
      const tempItem: Expense = {
        ...payload,
        id: tempId,
        platform: payload.platform,
        notes: payload.notes,
        created_at: new Date().toISOString(),
      }
      saveExpenses(prev => [tempItem, ...prev])

      const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select()
        .single()

      if (!error && data) {
        saveExpenses(prev => prev.map(e => e.id === tempId ? (data as Expense) : e))
      }
      // No rollback — item stays in local cache even if server fails
    }
  }

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      saveExpenses(prev => prev.filter(e => e.id !== id))
      setConfirmDelete(null)
      supabase.from('expenses').delete().eq('id', id)
    } else {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  const filtered = expenses.filter(e => {
    if (filterCat !== 'All' && e.category !== filterCat) return false
    if (filterProject !== 'All' && (e.project_id ?? 'General') !== filterProject) return false
    return true
  })

  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const breakdown = categoryPercents(expenses)
  const projectOptions = ['General', ...projects.map(p => p.name)]

  return (
    <div className="px-4 pt-6 pb-28 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-[#555] mt-0.5">
            {formatINR(total)} shown
            {syncing && <span className="text-[#444] ml-2">· syncing</span>}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-white text-black text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-transform"
        >
          + Add
        </button>
      </div>

      {/* Breakdown bar */}
      {expenses.length > 0 && (
        <div className="mb-5">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-[#1a1a1a] mb-2">
            {breakdown.map((b, i) => (
              <div key={b.category} style={{ width: `${b.pct}%`, opacity: 1 - i * 0.2 }} className="bg-white" />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {breakdown.map(b => (
              <span key={b.category} className="text-xs text-[#555]">
                {b.category} {b.pct.toFixed(0)}% · {formatINR(b.amount)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category filter chips */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
        {(['All', ...CATEGORIES] as const).map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c === 'All' ? 'All' : filterCat === c ? 'All' : c)}
            className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap font-medium transition-all ${
              filterCat === c ? 'bg-white text-black border-white' : 'border-[#2a2a2a] text-[#666]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Project filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFilterProject('All')}
          className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap font-medium transition-all ${
            filterProject === 'All' ? 'bg-white text-black border-white' : 'border-[#2a2a2a] text-[#666]'
          }`}
        >
          All Projects
        </button>
        {projectOptions.map(p => (
          <button
            key={p}
            onClick={() => setFilterProject(filterProject === p ? 'All' : p)}
            className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap font-medium transition-all ${
              filterProject === p ? 'bg-white text-black border-white' : 'border-[#2a2a2a] text-[#666]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[#111] rounded-xl h-16 animate-pulse border border-[#1a1a1a]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[#333] text-3xl mb-3">—</p>
          <p className="text-white text-base font-medium">No expenses found</p>
          <p className="text-[#555] text-sm mt-1">
            {expenses.length === 0 ? 'Tap + Add to log your first expense' : 'Try a different filter'}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map(e => (
            <div key={e.id}>
              <ExpenseRow expense={e} onEdit={openEdit} onDelete={handleDelete} />
              {confirmDelete === e.id && (
                <p className="text-xs text-[#888] text-center py-1.5 italic">
                  Tap delete again to confirm
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing ? 'Edit Expense' : 'New Expense'}>
        <div className="flex flex-col gap-5">
          <Field label="Expense Name">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Meta Ads"
              autoFocus
              className="input"
            />
          </Field>

          <Field label="Category">
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, category: c })}
                  className={`h-11 text-xs font-bold rounded-xl border transition-all ${
                    form.category === c ? 'bg-white text-black border-white' : 'bg-black text-[#555] border-[#2a2a2a]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform (optional)">
              <input
                type="text"
                value={form.platform}
                onChange={e => setForm({ ...form, platform: e.target.value })}
                placeholder="Meta, Google..."
                className="input"
              />
            </Field>
            <Field label="Amount (₹)">
              <input
                type="number"
                inputMode="numeric"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="input font-bold"
              />
            </Field>
          </div>

          <Field label="Type">
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 h-11 text-xs font-bold rounded-xl border transition-all ${
                    form.type === t ? 'bg-white text-black border-white' : 'bg-black text-[#555] border-[#2a2a2a]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Project">
            <select
              value={form.project_id}
              onChange={e => setForm({ ...form, project_id: e.target.value })}
              className="input"
            >
              {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>

          <Field label="Date">
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="Notes (optional)">
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. April billing"
              className="input"
            />
          </Field>

          <button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.amount}
            className="w-full h-14 bg-white text-black font-bold text-base rounded-xl disabled:opacity-30 active:scale-98 transition-all"
          >
            {editing ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-[#555] block mb-2">{label}</label>
      {children}
    </div>
  )
}
