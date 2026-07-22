import { createClient } from '@/lib/supabase/server'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

export async function AppShell({
  children,
  currentProjectId = null,
  currentPath,
}: {
  children: React.ReactNode
  currentProjectId?: string | null
  currentPath?: string
}) {
  const supabase = await createClient()
  // sort_order 컬럼이 있으면 사용, 없어도 안전하게 fallback
  const [projectsWithSort, tcsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('testcases').select('project_id, latest_result'),
  ])

  let projectsRes = projectsWithSort
  if (projectsWithSort.error) {
    // sort_order 컬럼 없으면 created_at 만으로 재조회
    projectsRes = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
  }

  const projects = projectsRes.data ?? []
  const tcs = tcsRes.data ?? []

  // 프로젝트별 진행률 계산
  const statsByProject = new Map<string, { total: number; pass: number }>()
  for (const tc of tcs) {
    const s = statsByProject.get(tc.project_id) ?? { total: 0, pass: 0 }
    s.total += 1
    if (tc.latest_result === 'PASS') s.pass += 1
    statsByProject.set(tc.project_id, s)
  }

  const projectsWithStats = projects.map((p) => {
    const s = statsByProject.get(p.id) ?? { total: 0, pass: 0 }
    return {
      ...p,
      totalTcs: s.total,
      passRate: s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex-1 flex min-h-0">
        <Sidebar
          projects={projectsWithStats}
          currentProjectId={currentProjectId}
          currentPath={currentPath}
        />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
