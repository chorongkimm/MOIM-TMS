import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '../_components/AppShell'
import { ExportMenu } from '../_components/ExportMenu'
import { FilterBar } from '../_components/FilterBar'
import { SprintDatePicker } from '../_components/SprintDatePicker'
import { TestcaseTable } from '../_components/TestcaseTable'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const filterPriority = typeof params.priority === 'string' ? params.priority : ''
  const filterEnvironment = typeof params.environment === 'string' ? params.environment : ''
  const selectedPrefix = typeof params.project === 'string' ? params.project : ''
  const sortKey = typeof params.sort === 'string' ? params.sort : 'tcno-asc'

  const supabase = await createClient()

  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .order('created_at')

  if (projErr) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg border border-red-200 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-600">DB 연결 에러</h1>
          <pre className="mt-4 p-4 bg-red-50 rounded text-sm whitespace-pre-wrap text-red-800">{projErr.message}</pre>
        </div>
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h1 className="text-xl font-bold">프로젝트가 없습니다</h1>
          <p className="mt-2 text-gray-600">
            <Link href="/testcases/new" className="text-yellow-600 hover:underline font-medium">
              첫 TC 만들며 프로젝트 시작하기 →
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // 현재 프로젝트: URL param 우선, 없으면 첫 번째
  const project = projects.find((p) => p.tc_prefix === selectedPrefix) ?? projects[0]

  // 필터 적용해서 TC 조회 (도메인 정보 포함)
  let query = supabase
    .from('testcases')
    .select('*, domains(id, name, sort_order, color)')
    // execution_status 는 * 안에 포함됨
    .eq('project_id', project.id)

  if (q) query = query.ilike('title', `%${q}%`)
  if (filterPriority) query = query.eq('priority', filterPriority)
  if (filterEnvironment) query = query.eq('environment', filterEnvironment)

  // 정렬 매핑
  const SORT_MAP: Record<string, { field: string; ascending: boolean }> = {
    'created-desc': { field: 'created_at', ascending: false },
    'created-asc': { field: 'created_at', ascending: true },
    'updated-desc': { field: 'updated_at', ascending: false },
    'updated-asc': { field: 'updated_at', ascending: true },
    'title-asc': { field: 'title', ascending: true },
    'title-desc': { field: 'title', ascending: false },
    'tcno-asc': { field: 'tc_no', ascending: true },
    'tcno-desc': { field: 'tc_no', ascending: false },
  }
  const sort = SORT_MAP[sortKey] ?? SORT_MAP['tcno-asc']
  const { data: testcases } = await query.order(sort.field, { ascending: sort.ascending })

  const { data: allEnvs } = await supabase
    .from('testcases')
    .select('environment')
    .eq('project_id', project.id)
  const environments = Array.from(
    new Set((allEnvs ?? []).map((r) => r.environment).filter(Boolean))
  ).sort()

  const hasAnyFilter = !!(q || filterPriority || filterEnvironment)

  return (
    <AppShell currentProjectId={project.id} currentPath="/testcases">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm flex-1 min-w-0">
          <Link href="/" className="text-gray-500 hover:text-gray-700">모든 프로젝트</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-medium truncate">{project.name}</span>
          <SprintDatePicker
            projectId={project.id}
            startDate={(project.start_date as string | null) ?? null}
            endDate={(project.end_date as string | null) ?? null}
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <ExportMenu projectPrefix={project.tc_prefix} />
          <Link
            href={`/testcases/sync-results?project=${project.tc_prefix}`}
            className="px-3.5 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            확인결과 동기화
          </Link>
          <Link
            href={`/testcases/import?project=${project.tc_prefix}`}
            className="px-3.5 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            가져오기
          </Link>
          <Link
            href={`/testcases/new?project=${project.tc_prefix}`}
            className="px-3.5 py-2 text-sm bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 font-medium shadow-sm"
          >
            + TC 만들기
          </Link>
        </div>
      </header>

      <main className="p-6 space-y-4">
        <FilterBar environments={environments} />
        <TestcaseTable
          testcases={testcases ?? []}
          projectId={project.id}
          projectPrefix={project.tc_prefix}
          hasAnyFilter={hasAnyFilter}
        />
      </main>
    </AppShell>
  )
}
