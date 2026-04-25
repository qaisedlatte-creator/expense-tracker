'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/expenses',
    label: 'Expenses',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: '/calculator',
    label: 'Calculator',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="8" y2="10" strokeWidth="3" strokeLinecap="round" />
        <line x1="12" y1="10" x2="12" y2="10" strokeWidth="3" strokeLinecap="round" />
        <line x1="16" y1="10" x2="16" y2="10" strokeWidth="3" strokeLinecap="round" />
        <line x1="8" y1="14" x2="8" y2="14" strokeWidth="3" strokeLinecap="round" />
        <line x1="12" y1="14" x2="12" y2="14" strokeWidth="3" strokeLinecap="round" />
        <line x1="16" y1="14" x2="16" y2="14" strokeWidth="3" strokeLinecap="round" />
        <line x1="8" y1="18" x2="8" y2="18" strokeWidth="3" strokeLinecap="round" />
        <line x1="12" y1="18" x2="12" y2="18" strokeWidth="3" strokeLinecap="round" />
        <line x1="16" y1="18" x2="16" y2="18" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black border-t border-[#222] safe-bottom">
      <div className="max-w-md mx-auto flex">
        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                active ? 'text-white' : 'text-[#444]'
              }`}
            >
              {tab.icon(active)}
              <span className={`text-[10px] tracking-wide uppercase ${active ? 'font-bold' : 'font-normal'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
