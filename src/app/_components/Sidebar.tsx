import Image from 'next/image'
import Link from 'next/link'
import { ProjectList } from './ProjectList'

type Project = {
  id: string
  name: string
  tc_prefix: string
  totalTcs?: number
  passRate?: number
}

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
}

export function Sidebar({
  projects,
  currentProjectId,
  currentPath,
}: {
  projects: Project[]
  currentProjectId: string | null
  currentPath?: string
}) {
  const navItems: NavItem[] = [
    {
      href: '/',
      label: '대시보드',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
  ]
  const isDashboard = currentPath === '/'

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col self-start sticky top-12 h-[calc(100vh-3rem)]">
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/moin-logo.png"
            alt="Moin"
            width={44}
            height={28}
            className="object-contain"
            priority
          />
          <div>
            <div className="font-bold text-sm text-gray-900">MOIN TMS</div>
            <div className="text-xs text-gray-500">Test Case Manager</div>
          </div>
        </Link>
      </div>

      {/* 상단 내비 */}
      <div className="py-3 px-3 border-b border-gray-100">
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2 px-2 py-2 rounded-md text-sm
                ${isDashboard && item.href === '/'
                  ? 'bg-yellow-50 text-yellow-900 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'}
              `}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* 프로젝트(스프린트) 목록 */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            스프린트
          </span>
          <span className="text-[10px] text-gray-400" title="이름을 더블클릭하면 수정할 수 있어요">
            ✏️
          </span>
        </div>
        <ProjectList projects={projects} currentProjectId={currentProjectId} />
      </div>

      {/* 하단 정보 */}
      <div className="px-5 py-3 border-t border-gray-200 text-xs text-gray-400">
        MOIN TMS · MVP
      </div>
    </aside>
  )
}
