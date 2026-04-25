'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatINR, categoryPercents } from '@/lib/calculations'
import type { Expense, ExpenseCategory, ExpenseType, Project } from '@/types'
import ExpenseRow from '@/components/ExpenseRow'
import BottomSheet from '@/components/BottomSheet'

const CATEGORIES: ExpenseCategory[] = ['Ads', 'Tools', 'Domain', 'Other']
const TYPES: ExpenseType[] = ['One-Time', 'Monthly', 'Variable']

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
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState<ExpenseCategory | 'All'>('All')
  const [filterProject, setFilterProject] = useState<string>('All')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const initialized = useRef(false)

  async function serverSync() {
    const [{ data: exp }, { data: proj }] = await Promise.all([
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('projects').select('*').order('name'),
    ])
    if (exp) setExpenses(exp as Expense[])
    if (proj) setProjects(proj as Project[])
    setLoading(false)
  }

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      serverSync()
    }

    const ch = supabase
      .channel('expenses-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, (payload) => {
        const incoming = payload.new as Expense
        setExpenses((prev) => {
          if (prev.some((e) => e.id === incoming.id)) return prev
          return [incoming, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'expenses' }, (payload) => {
        const updated = payload.new as Expense
        setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'expenses' }, (payload) => {
        setExpenses((prev) => prev.filter((e) => e.id !== (payload.old as Expense).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
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
    if (!form.name.trim() || !form.amount) return

    const payload = {
      name: form.name.trim(),
      category: form.category,
      platform: form.platform.trim() || null,
      amount: parseFloat(form.amount),
      type: form.type,
      project_id: form.project_id || 'General',
      date: form.date,
      notes: form.notes.trim() || null,
    }

    if (editing) {
      setExpenses((prev) =>
        prev.map((e) => (e.id === editing.id ? { ...e, ...payload } : e))
      )
      setSheetOpen(false)
      supabase.from('expenses').update(payload).eq('id', editing.id).then(() => serverSync())
    } else {
      const tempId = `temp-${Date.now()}`
      const tempExpense: Expense = {
        ...payload,
        id: tempId,
        platform: payload.platform,
        notes: payload.notes,
        created_at: new Date().toISOString(),
      }
      setExpenses((prev) => [tempExpense, ...prev])
      setSheetOpen(false)
      const { data } = await supabase.from('expenses').insert(payload).select().single()
      if (data) {
        setExpenses((prev) =>
          prev.map((e) => (e.id === tempId ? (data as Expense) : e))
        )
      } else {
        setExpenses((prev) => prev.filter((e) => e.id !== tempId))
      }
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete === id) {
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      setConfirmDelete(null)
      supabase.from('expenses').delete().eq('id', id)
    } else {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  const filtered = expenses.filter((e) => {
    if (filterCat !== 'All' && e.category !== filterCat) return false
    if (filterProject !== 'All' && (e.project_id ?? 'General') !== filterProject) return false
    return true
  })

  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const breakdown = categoryPercents(expenses)
  const projectOptions = ['General', ...projects.map((p) => p.name)]

  return (
    <div className="px-4 pt-6 pb-32 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Expenses</h1>
          <p className="text-xs text-[#555] mt-0.5">Showing: {formatINR(total)}</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-white text-black text-xs font-bold px-4 py-2 rounded-lg"
        >
          + Add
        </button>
      </div>

      {/* Category breakdown bar */}
      {expenses.length > 0 && (
        <div className="mb-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-[#1a1a1a] mb-1.5">
            {breakdown.map((b, i) => (
              <div
                key={b.category}
                style={{ width: `${b.pct}%`, opacity: 1 - i * 0.2 }}
                className="bg-white"
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {breakdown.map((b) => (
              <span key={b.category} className="text-[10px] text-[#555]">
                {b.category} {b.pct.toFixed(0)}% · {formatINR(b.amount)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c === 'All' ? 'All' : (filterCat === c ? 'All' : c))}
            className={`text-[10px] px-2.5 py-1 rounded-full border whitespace-nowrap transition-all ${
              filterCat === c ? 'bg-white text-black border-white font-bold' : 'border-[#333] text-[#666]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Project filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFilterProject('All')}
          className={`text-[10px] px-2.5 py-1 rounded border whitespace-nowrap ${
            filterProject === 'All' ? 'bg-white text-black border-white font-bold' : 'border-[#2a2a2a] text-[#555]'
          }`}
        >
          All Projects
        </button>
        {projectOptions.map((p) => (
          <button
            key={p}
            onClick={() => setFilterProject(filterProject === p ? 'All' : p)}
            className={`text-[10px] px-2.5 py-1 rounded border whitespace-nowrap ${
              filterProject === p ? 'bg-white text-black border-white font-bold' : 'border-[#2a2a2a] text-[#555]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border border-white border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#444] text-sm">No expenses found</p>
          <p className="text-[#333] text-xs mt-1">
            {expenses.length === 0 ? 'Add your first expense above' : 'Try a different filter'}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((e) => (
            <div key={e.id}>
              <ExpenseRow expense={e} onEdit={openEdit} onDelete={handleDelete} />
              {confirmDelete === e.id && (
                <p className="text-[11px] text-white text-center py-1 italic">
                  Tap delete again to confirm
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit Expense' : 'New Expense'}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Meta Ads"
              className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, category: c })}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    form.category === c ? 'bg-white text-black border-white' : 'bg-black text-[#666] border-[#333]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">Platform</label>
              <input
                type="text"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                placeholder="Google, Meta..."
                className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">Amount (₹)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">Type</label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                    form.type === t ? 'bg-white text-black border-white' : 'bg-black text-[#666] border-[#333]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">Project</label>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white"
            >
              {projectOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. March billing"
              className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.amount}
            className="w-full bg-white text-black font-bold py-3 rounded-lg text-sm disabled:opacity-40"
          >
            {editing ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
