'use client'

import type { Project, ProjectStatus } from '@/types'
import { formatINR } from '@/lib/calculations'

interface Props {
  project: Project
  onStatusToggle: (id: string, newStatus: ProjectStatus) => void
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}

const STATUS_NEXT: Record<ProjectStatus, ProjectStatus> = {
  Pending: 'Confirmed',
  Confirmed: 'Paid',
  Paid: 'Pending',
}

const STATUS_STYLE: Record<ProjectStatus, string> = {
  Pending: 'border border-[#444] text-[#888]',
  Confirmed: 'border border-white text-white',
  Paid: 'bg-white text-black',
}

export default function ProjectCard({ project, onStatusToggle, onEdit, onDelete }: Props) {
  return (
    <div
      className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-start justify-between gap-3"
      onClick={() => onEdit(project)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-bold text-sm truncate">{project.name}</p>
          {project.status === 'Pending' && (
            <span className="text-[10px] italic text-[#666] shrink-0">(unconfirmed)</span>
          )}
        </div>
        <p className="text-xl font-bold tracking-tight">
          {formatINR(project.amount)}
        </p>
        {project.notes && (
          <p className="text-xs text-[#555] mt-1 truncate">{project.notes}</p>
        )}
        <p className="text-[10px] text-[#444] mt-1">{project.date}</p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStatusToggle(project.id, STATUS_NEXT[project.status])
          }}
          className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider transition-all ${STATUS_STYLE[project.status]}`}
        >
          {project.status}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(project.id)
          }}
          className="text-[#444] hover:text-white transition-colors"
          aria-label="Delete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
