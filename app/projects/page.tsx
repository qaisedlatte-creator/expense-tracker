'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { cache, fromCache } from '@/lib/cache'
import { formatINR } from '@/lib/calculations'
import type { Project, Expense, ProjectStatus } from '@/types'
import ProjectCard from '@/components/ProjectCard'
import BottomSheet from '@/components/BottomSheet'

const EMPTY_FORM = {
  name:   '',
  amount: '',
  status: 'Pending' as ProjectStatus,
  date:   new Date().toISOString().split('T')[0],
  notes:  '',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(() => fromCache<Project[]>('projects', []))
  const [expenses, setExpenses] = useState<Expense[]>(() => fromCache<Expense[]>('expenses', []))
  const [loading,  setLoading]  = useState(projects.length === 0)
  const [syncing,  setSyncing]  = useState(false)
  const [sheetOpen, setSheetOpen]         = useState(false)
  const [editing,   setEditing]           = useState<Project | null>(null)
  const [form,      setForm]              = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const didMount = useRef(false)

  function saveProjects(updater: (prev: Project[]) => Project[]) {
    setProjects(prev => {
      const next = updater(prev)
      cache.set('projects', next)
      return next
    })
  }

  async function serverSync() {
    setSyncing(true)
    const [{ data: proj, error: e1 }, { data: exp }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
    ])
    setSyncing(false)
    if (!e1 && proj) {
      saveProjects(() => proj as Project[])
    }
    if (exp) {
      setExpenses(exp as Expense[])
      cache.set('expenses', exp)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (didMount.current) return
    didMount.current = true
    serverSync()

    const ch = supabase
      .channel('projects-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects' }, (p) => {
        const row = p.new as Project
        saveProjects(prev => prev.some(x => x.id === row.id) ? prev : [row, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, (p) => {
        const row = p.new as Project
        saveProjects(prev => prev.map(x => x.id === row.id ? row : x))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'projects' }, (p) => {
        saveProjects(prev => prev.filter(x => x.id !== (p.old as Project).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })
    setSheetOpen(true)
  }

  function openEdit(project: Project) {
    setEditing(project)
    setForm({
      name:   project.name,
      amount: String(project.amount),
      status: project.status,
      date:   project.date,
      notes:  project.notes ?? '',
    })
    setSheetOpen(true)
  }

  async function handleSave() {
    const name   = form.name.trim()
    const amount = parseFloat(form.amount)
    if (!name || !amount) return

    const payload = {
      name,
      amount,
      status: form.status,
      date:   form.date,
      notes:  form.notes.trim() || null,
    }

    setSheetOpen(false)

    if (editing) {
      saveProjects(prev => prev.map(p => p.id === editing.id ? { ...p, ...payload } : p))
      supabase.from('projects').update(payload).eq('id', editing.id).then(() => serverSync())
    } else {
      const tempId   = `tmp_${Date.now()}`
      const tempItem: Project = { ...payload, id: tempId, notes: payload.notes, created_at: new Date().toISOString() }
      saveProjects(prev => [tempItem, ...prev])

      const { data, error } = await supabase.from('projects').insert(payload).select().single()
      if (!error && data) {
        saveProjects(prev => prev.map(p => p.id === tempId ? (data as Project) : p))
      }
    }
  }

  function handleStatusToggle(id: string, newStatus: ProjectStatus) {
    saveProjects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
    supabase.from('projects').update({ status: newStatus }).eq('id', id)
  }

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      saveProjects(prev => prev.filter(p => p.id !== id))
      setConfirmDelete(null)
      supabase.from('projects').delete().eq('id', id)
    } else {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  // Per-project P&L calculation
  function getProjectPnL(project: Project) {
    const linked = expenses.filter(e => e.project_id === project.name)
    const expTotal = linked.reduce((s, e) => s + e.amount, 0)
    const profit   = project.amount - expTotal
    const margin   = project.amount > 0 ? (profit / project.amount) * 100 : 0
    return { expenses: expTotal, profit, margin }
  }

  const confirmed   = projects.filter(p => p.status === 'Confirmed' || p.status === 'Paid')
  const pending     = projects.filter(p => p.status === 'Pending')
  const totalRevenue = confirmed.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="px-4 pt-6 pb-28 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tx">Projects</h1>
          <p className="text-sm text-t4 mt-0.5">
            {formatINR(totalRevenue)} confirmed
            {syncing && <span className="text-t5 ml-2">· syncing</span>}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-ac text-acf text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-transform"
        >
          + Add
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-surface rounded-xl h-20 animate-pulse border border-bdf" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-t6 text-3xl mb-3">—</p>
          <p className="text-tx text-base font-medium">No projects yet</p>
          <p className="text-t4 text-sm mt-1">Tap + Add to create your first one</p>
        </div>
      ) : (
        <>
          {confirmed.length > 0 && (
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-t5 mb-3">Active</p>
              <div className="flex flex-col gap-2.5">
                {confirmed.map(p => (
                  <div key={p.id}>
                    <ProjectCard
                      project={p}
                      pnl={getProjectPnL(p)}
                      onStatusToggle={handleStatusToggle}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                    {confirmDelete === p.id && (
                      <p className="text-xs text-t2 text-center mt-1.5 italic">Tap delete again to confirm</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-t5 mb-3">Pending</p>
              <div className="flex flex-col gap-2.5">
                {pending.map(p => (
                  <div key={p.id}>
                    <ProjectCard
                      project={p}
                      pnl={getProjectPnL(p)}
                      onStatusToggle={handleStatusToggle}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                    {confirmDelete === p.id && (
                      <p className="text-xs text-t2 text-center mt-1.5 italic">Tap delete again to confirm</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing ? 'Edit Project' : 'New Project'}>
        <div className="flex flex-col gap-5">
          <Field label="Project Name">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Website for Client A"
              autoFocus
              className="input"
            />
          </Field>

          <Field label="Revenue (₹)">
            <input
              type="number"
              inputMode="numeric"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              className="input text-xl font-bold"
            />
          </Field>

          <Field label="Status">
            <div className="flex gap-2">
              {(['Pending', 'Confirmed', 'Paid'] as ProjectStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, status: s })}
                  className={`flex-1 h-11 text-sm font-bold rounded-xl border transition-all ${
                    form.status === s
                      ? 'bg-ac text-acf border-ac'
                      : 'bg-bg text-t4 border-bdh'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
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
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Any notes..."
              rows={2}
              className="input"
            />
          </Field>

          <button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.amount}
            className="w-full h-14 bg-ac text-acf font-bold text-base rounded-xl disabled:opacity-30 active:scale-98 transition-all"
          >
            {editing ? 'Save Changes' : 'Add Project'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-t4 block mb-2">{label}</label>
      {children}
    </div>
  )
}
