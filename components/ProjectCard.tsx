'use client'

import type { Project, ProjectStatus } from '@/types'
import { formatINR } from '@/lib/calculations'

interface ProjectPnL {
  expenses: number
  profit: number
  margin: number
}

interface Props {
  project: Project
  pnl?: ProjectPnL
  onStatusToggle: (id: string, newStatus: ProjectStatus) => void
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}

const STATUS_NEXT: Record<ProjectStatus, ProjectStatus> = {
  Pending:   'Confirmed',
  Confirmed: 'Paid',
  Paid:      'Pending',
}

const STATUS_STYLE: Record<ProjectStatus, string> = {
  Pending:   'border border-bda text-t2',
  Confirmed: 'border border-ac text-tx',
  Paid:      'bg-ac text-acf',
}

export default function ProjectCard({ project, pnl, onStatusToggle, onEdit, onDelete }: Props) {
  const hasExpenses = pnl && pnl.expenses > 0
  const isConfirmedOrPaid = project.status === 'Confirmed' || project.status === 'Paid'

  return (
    <div
      className="bg-surface border border-bdr rounded-xl p-4"
      onClick={() => onEdit(project)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-bold text-sm text-tx truncate">{project.name}</p>
            {project.status === 'Pending' && (
              <span className="text-[10px] italic text-t3 shrink-0">(unconfirmed)</span>
            )}
          </div>
          <p className="text-xl font-bold tracking-tight text-tx">
            {formatINR(project.amount)}
          </p>
          {project.notes && (
            <p className="text-xs text-t4 mt-1 truncate">{project.notes}</p>
          )}
          <p className="text-[10px] text-t5 mt-1">{project.date}</p>
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
            className="text-t5 hover:text-tx transition-colors"
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

      {/* P&L breakdown — shown when expenses exist */}
      {isConfirmedOrPaid && pnl !== undefined && (
        <div className="mt-3 pt-3 border-t border-bdf">
          {hasExpenses ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-center flex-1">
                <p className="text-[10px] text-t4 uppercase tracking-widest mb-0.5">Revenue</p>
                <p className="text-sm font-bold text-tx">{formatINR(project.amount)}</p>
              </div>
              <div className="text-t5 text-xs">−</div>
              <div className="text-center flex-1">
                <p className="text-[10px] text-t4 uppercase tracking-widest mb-0.5">Costs</p>
                <p className="text-sm font-bold text-tx">{formatINR(pnl.expenses)}</p>
              </div>
              <div className="text-t5 text-xs">=</div>
              <div className="text-center flex-1">
                <p className="text-[10px] text-t4 uppercase tracking-widest mb-0.5">Profit</p>
                <p className={`text-sm font-bold ${pnl.profit >= 0 ? 'text-tx' : 'text-t2'}`}>
                  {pnl.profit < 0 ? '−' : ''}{formatINR(Math.abs(pnl.profit))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-t4 uppercase tracking-widest mb-0.5">Margin</p>
                <p className={`text-sm font-bold ${pnl.margin >= 25 ? 'text-tx' : 'text-t3'}`}>
                  {pnl.margin.toFixed(0)}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-t5 italic">No expenses logged for this project</p>
          )}
        </div>
      )}

      {/* For Pending projects with expenses, still show costs */}
      {project.status === 'Pending' && hasExpenses && (
        <div className="mt-3 pt-3 border-t border-bdf">
          <p className="text-[11px] text-t4">
            {formatINR(pnl!.expenses)} costs logged ·{' '}
            <span className="text-t5">pending confirmation</span>
          </p>
        </div>
      )}
    </div>
  )
}
