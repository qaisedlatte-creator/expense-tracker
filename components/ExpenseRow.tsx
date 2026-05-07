'use client'

import type { Expense } from '@/types'
import { formatINR } from '@/lib/calculations'

interface Props {
  expense: Expense
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}

const CAT_LABEL: Record<string, string> = {
  Ads:    'ADS',
  Tools:  'TOOL',
  Domain: 'DOM',
  Other:  'OTH',
}

export default function ExpenseRow({ expense, onEdit, onDelete }: Props) {
  const isMonthly = expense.type === 'Monthly'

  return (
    <div
      className="flex items-start justify-between gap-3 py-3 border-b border-bdf cursor-pointer active:bg-surface transition-colors px-1"
      onClick={() => onEdit(expense)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[9px] font-bold tracking-widest text-t4 border border-bds px-1.5 py-0.5 rounded">
            {CAT_LABEL[expense.category]}
          </span>
          <p className="text-sm font-medium text-tx truncate">{expense.name}</p>
          {isMonthly && (
            <span className="text-[9px] border border-bda text-t3 px-1.5 py-0.5 rounded-full shrink-0">
              RECURRING
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-t4">
          {expense.platform && <span>{expense.platform}</span>}
          {expense.platform && <span>·</span>}
          <span>{expense.project_id ?? 'General'}</span>
          <span>·</span>
          <span>{expense.date}</span>
        </div>
        {expense.notes && (
          <p className="text-[10px] text-t5 mt-0.5 truncate">{expense.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-sm font-bold text-tx">{formatINR(expense.amount)}</p>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(expense.id)
          }}
          className="text-t5 hover:text-tx transition-colors"
          aria-label="Delete"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
