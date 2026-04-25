'use client'

import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full max-w-md bg-[#0d0d0d] border-t border-[#222] rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 bg-[#333] rounded-full" />
        </div>

        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-[#555] hover:text-white rounded-xl transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: 'calc(92dvh - 80px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
