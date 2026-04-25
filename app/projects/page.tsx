'use client'

import { useEffect, useState, useRef } from 'react'
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const initialized = useRef(false)

  // Fetch from server — only used on mount and for cross-device realtime sync
  async function serverSync() {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setProjects(data as Project[])
    setLoading(false)
  }

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      serverSync()
    }

    const ch = supabase
      .channel('projects-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects' }, (payload) => {
        const incoming = payload.new as Project
        setProjects((prev) => {
          // Skip if we already have it (our own optimistic add)
          if (prev.some((p) => p.id === incoming.id)) return prev
          return [incoming, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, (payload) => {
        const updated = payload.new as Project
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'projects' }, (payload) => {
        setProjects((prev) => prev.filter((p) => p.id !== (payload.old as Project).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

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
    if (!form.name.trim() || !form.amount) return

    const payload = {
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      status: form.status,
      date: form.date,
      notes: form.notes.trim() || null,
    }

    if (editing) {
      // Optimistic update — instant
      setProjects((prev) =>
        prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p))
      )
      setSheetOpen(false)
      supabase.from('projects').update(payload).eq('id', editing.id).then(() => serverSync())
    } else {
      // Optimistic insert with temp ID — instant
      const tempId = `temp-${Date.now()}`
      const tempProject: Project = {
        ...payload,
        id: tempId,
        notes: payload.notes,
        created_at: new Date().toISOString(),
      }
      setProjects((prev) => [tempProject, ...prev])
      setSheetOpen(false)
      // Confirm with server and replace temp ID with real ID
      const { data } = await supabase.from('projects').insert(payload).select().single()
      if (data) {
        setProjects((prev) =>
          prev.map((p) => (p.id === tempId ? (data as Project) : p))
        )
      } else {
        // Rollback on error
        setProjects((prev) => prev.filter((p) => p.id !== tempId))
      }
    }
  }

  function handleStatusToggle(id: string, newStatus: ProjectStatus) {
    // Optimistic — instant tap response
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)))
    supabase.from('projects').update({ status: newStatus }).eq('id', id)
  }

  async function handleDelete(id: string) {
    if (confirmDelete === id) {
      // Optimistic remove — instant
      setProjects((prev) => prev.filter((p) => p.id !== id))
      setConfirmDelete(null)
      supabase.from('projects').delete().eq('id', id)
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
                    form.status === s ? 'bg-white text-black border-white' : 'bg-black text-[#666] border-[#333]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
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
            disabled={!form.name.trim() || !form.amount}
            className="w-full bg-white text-black font-bold py-3 rounded-lg text-sm disabled:opacity-40"
          >
            {editing ? 'Save Changes' : 'Add Project'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
