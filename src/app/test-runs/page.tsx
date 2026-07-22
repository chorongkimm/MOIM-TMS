import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '../_components/AppShell'
import { ResultPieChart, ResultSummaryText } from '../_components/ResultPieChart'

const RESULT_COLORS = {
  PASS: '#22c55e',
  FAIL: '#ef4444',
  'N/T': '#9ca3af',
  'N/A': '#eab308',
} as const

const RESULT_LABELS = {
  PASS: 'Passed',
  FAIL: 'Failed',
  'N/T': 'Untested',
  'N/A': 'N/A',
} as const

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function TestRunsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const selectedPrefix = typeof params.project === 'string' ? params.project : ''

  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at')

  if (!projects || projects.length === 0) {
    return (
      <AppShell currentPath="/test-runs">
        <div className="p-8 text-center text-gray-500">
          프로젝트가 없어요.{' '}
          <Link href="/testcases/new" className="text-yellow-600 hover:underline">첫 TC 만들기 →</Link>
        </div>
      </AppShell>
    )
  }

  const project = projects.find((p) => p.tc_prefix === selectedPrefix) ?? projects[0]

  const { data: testcases } = await supabase
    .from('testcases')
    .select('id, tc_no, title, priority, type, latest_result, updated_at, domain_id, domains(id, name, sort_order, color)')
    .eq('project_id', project.id)
    .order('tc_no')

  const tcs = testcases ?? []

  // 결과 집계
  const counts: Record<'PASS' | 'FAIL' | 'N/T' | 'N/A', number> = {
    PASS: 0, FAIL: 0, 'N/T': 0, 'N/A': 0,
  }
  for (const tc of tcs) {
    const r = (tc.latest_result ?? 'N/T') as keyof typeof counts
    counts[r] = (counts[r] ?? 0) + 1
  }

  const countsData = (['PASS', 'FAIL', 'N/T', 'N/A'] as const).map((k) => ({
    key: k,
    label: RESULT_LABELS[k],
    count: counts[k],
    color: RESULT_COLORS[k],
  }))

  // 폴더별 그룹핑
  type FolderStat = {
    key: string
    name: string
    sortOrder: number
    counts: Record<'PASS' | 'FAIL' | 'N/T' | 'N/A', number>
    total: number
  }
  const folderMap = new Map<string, FolderStat>()
  for (const tc of tcs) {
    const dom = tc.domains as { id: string; name: string; sort_order?: number } | null
    const key = dom?.id ?? '__none__'
    if (!folderMap.has(key)) {
      folderMap.set(key, {
        key,
        name: dom?.name ?? '(폴더 미지정)',
        sortOrder: dom?.sort_order ?? Number.POSITIVE_INFINITY,
        counts: { PASS: 0, FAIL: 0, 'N/T': 0, 'N/A': 0 },
        total: 0,
      })
    }
    const f = folderMap.get(key)!
    const r = (tc.latest_result ?? 'N/T') as keyof typeof f.counts
    f.counts[r] = (f.counts[r] ?? 0) + 1
    f.total++
  }
  const folders = Array.from(folderMap.values()).sort((a, b) => {
    if (a.key === '__none__') return 1
    if (b.key === '__none__') return -1
    return a.sortOrder - b.sortOrder
  })

  return (
    <AppShell currentProjectId={project.id} currentPath="/test-runs">
      {/* 프로젝트 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="text-gray-500 hover:text-gray-700">모든 프로젝트</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-medium">{project.name}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-1">Test Runs &amp; Results</h1>
      </header>

      <main className="p-6 space-y-6">
        {/* 파이 차트 + 요약 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">{project.name} 테스트 실행</h2>
            <p className="text-xs text-gray-500 mt-0.5">전체 TC {tcs.length}건의 최근 결과</p>
          </div>

          <ResultPieChart counts={countsData} total={tcs.length} />
          {tcs.length > 0 && <ResultSummaryText counts={countsData} total={tcs.length} />}
        </div>

        {/* 폴더별 진행률 */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">폴더별 결과</h3>
            <div className="text-xs text-gray-500">
              폴더 {folders.length}개 · TC {tcs.length}건
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">폴더</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">TC</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-green-700 uppercase tracking-wide">PASS</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-red-700 uppercase tracking-wide">FAIL</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-yellow-700 uppercase tracking-wide">N/A</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">N/T</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Pass율</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-64">진행 바</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {folders.map((f) => {
                  const passRate = f.total > 0 ? Math.round((f.counts.PASS / f.total) * 100) : 0
                  return (
                    <tr key={f.key} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className="text-yellow-700 mr-1">📁</span>
                        <span className="text-gray-900 font-medium">{f.name}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{f.total}</td>
                      <td className="px-4 py-2.5 text-right text-green-700 font-medium">{f.counts.PASS}</td>
                      <td className="px-4 py-2.5 text-right text-red-700 font-medium">{f.counts.FAIL}</td>
                      <td className="px-4 py-2.5 text-right text-yellow-700 font-medium">{f.counts['N/A']}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{f.counts['N/T']}</td>
                      <td className="px-4 py-2.5 text-right text-gray-900 font-semibold">{passRate}%</td>
                      <td className="px-4 py-2.5">
                        <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                          {(['PASS', 'FAIL', 'N/A', 'N/T'] as const).map((k) => {
                            const c = f.counts[k]
                            if (c === 0) return null
                            const pct = (c / f.total) * 100
                            return (
                              <div
                                key={k}
                                style={{ width: `${pct}%`, backgroundColor: RESULT_COLORS[k] }}
                                title={`${k}: ${c} (${Math.round(pct)}%)`}
                              />
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {folders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                      TC 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
