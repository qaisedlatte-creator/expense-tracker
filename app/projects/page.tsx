'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatINR } from '@/lib/calculations'
import type { Project, ProjectStatus } from '@/types'
import ProjectCard from '@/components/ProjectCard'
import BottomSheet from '@/components/BottomSheet'

const EMPTY_FORM = {
  name: '',
  amount: '',
  status: 'Pending' as ProjectStatus,
  date: new Date().toISOString().split('T')[0],
  notes: '',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    setProjects((data ?? []) as Project[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('projects-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setSheetOpen(true)
  }

  function openEdit(project: Project) {
    setEditing(project)
    setForm({
      name: project.name,
      amount: String(project.amount),
      status: project.status,
      date: project.date,
      notes: project.notes ?? '',
    })
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.amount) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      status: form.status,
      date: form.date,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      await supabase.from('projects').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('projects').insert(payload)
    }
    setSaving(false)
    setSheetOpen(false)
    load()
  }

  async function handleStatusToggle(id: string, newStatus: ProjectStatus) {
    await supabase.from('projects').update({ status: newStatus }).eq('id', id)
    load()
  }

  async function handleDelete(id: string) {
    if (confirmDelete === id) {
      await supabase.from('projects').delete().eq('id', id)
      setConfirmDelete(null)
      load()
    } else {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  const confirmed = projects.filter((p) => p.status === 'Confirmed' || p.status === 'Paid')
  const pending = projects.filter((p) => p.status === 'Pending')
  const totalRevenue = confirmed.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="px-4 pt-6 pb-32 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Projects</h1>
          <p className="text-xs text-[#555] mt-0.5">Revenue: {formatINR(totalRevenue)}</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-white text-black text-xs font-bold px-4 py-2 rounded-lg"
        >
          + Add
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border border-white border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#444] text-sm">No projects yet</p>
          <p className="text-[#333] text-xs mt-1">Add your first one above</p>
        </div>
      ) : (
        <>
          {/* Confirmed / Paid */}
          {confirmed.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] uppercase tracking-widest text-[#444] mb-2">Active</p>
              <div className="flex flex-col gap-2">
                {confirmed.map((p) => (
                  <div key={p.id}>
                    <ProjectCard
                      project={p}
                      onStatusToggle={handleStatusToggle}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                    {confirmDelete === p.id && (
                      <p className="text-[11px] text-white text-center mt-1 italic">
                        Tap delete again to confirm
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#444] mb-2">Pending</p>
              <div className="flex flex-col gap-2">
                {pending.map((p) => (
                  <div key={p.id}>
                    <ProjectCard
                      project={p}
                      onStatusToggle={handleStatusToggle}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                    {confirmDelete === p.id && (
                      <p className="text-[11px] text-white text-center mt-1 italic">
                        Tap delete again to confirm
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Form sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit Project' : 'New Project'}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Website Redesign"
              className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">
              Revenue (₹)
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">
              Status
            </label>
            <div className="flex gap-2">
              {(['Pending', 'Confirmed', 'Paid'] as ProjectStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, status: s })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                    form.status === s
                      ? 'bg-white text-black border-white'
                      : 'bg-black text-[#666] border-[#333]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any notes..."
              rows={2}
              className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.amount}
            className="w-full bg-white text-black font-bold py-3 rounded-lg text-sm disabled:opacity-40 transition-opacity"
          >
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Project'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
