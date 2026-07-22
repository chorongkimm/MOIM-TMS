'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = { href: string; label: string; disabled?: boolean }

const LEFT_TABS: Tab[] = [
  { href: '/', label: 'OVERVIEW' },
  { href: '/todo', label: 'TODO' },
  { href: '/test-runs', label: 'TEST RUNS & RESULTS' },
  { href: '/testcases', label: 'TEST CASES' },
  { href: '/reports', label: 'REPORTS' },
]

const RIGHT_TABS: Tab[] = [
  { href: '/administration', label: 'ADMINISTRATION' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

function TabLink({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active = isActive(pathname, tab.href)
  return (
    <Link
      href={tab.href}
      className={`
        px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-colors
        ${active
          ? 'text-white border-yellow-400'
          : 'text-gray-300 border-transparent hover:text-white hover:border-gray-500'}
      `}
    >
      {tab.label}
    </Link>
  )
}

export function TopNav() {
  const pathname = usePathname()
  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="flex items-center justify-between h-12 px-4">
        <div className="flex items-stretch">
          {LEFT_TABS.map((t) => <TabLink key={t.href} tab={t} pathname={pathname} />)}
        </div>
        <div className="flex items-stretch">
          {RIGHT_TABS.map((t) => <TabLink key={t.href} tab={t} pathname={pathname} />)}
        </div>
      </div>
    </nav>
  )
}
