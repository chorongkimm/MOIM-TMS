import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDateTimeKR as formatDateTime } from '@/lib/formatDate'
import { AppShell } from '../_components/AppShell'
import { ResultPieChart, ResultSummaryText } from '../_components/ResultPieChart'

type Result = 'PASS' | 'FAIL' | 'N/T' | 'N/A'

const RESULT_COLORS: Record<Result, string> = {
  PASS: '#22c55e',
  FAIL: '#ef4444',
  'N/T': '#9ca3af',
  'N/A': '#eab308',
}

const RESULT_LABELS: Record<Result, string> = {
  PASS: 'Passed',
  FAIL: 'Failed',
  'N/T': 'Untested',
  'N/A': 'N/A',
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const [projectsRes, tcsRes, historyRes] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase
      .from('testcases')
      .select('id, tc_no, title, priority, latest_result, updated_at, created_at, project_id, domain_id, projects(name, tc_prefix), domains(name)'),
    supabase
      .from('tc_edit_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const projects = projectsRes.data ?? []
  const testcases = tcsRes.data ?? []
  const history = historyRes.data ?? []

  // 전체 통계
  const totalTcs = testcases.length
  const resultCount: Record<Result, number> = { PASS: 0, FAIL: 0, 'N/T': 0, 'N/A': 0 }
  for (const tc of testcases) {
    const r = (tc.latest_result ?? 'N/T') as Result
    resultCount[r]++
  }
  const passRate = totalTcs > 0 ? Math.round((resultCount.PASS / totalTcs) * 100) : 0
  const executedRate = totalTcs > 0 ? Math.round(((totalTcs - resultCount['N/T']) / totalTcs) * 100) : 0

  const resultChartData = (['PASS', 'FAIL', 'N/T', 'N/A'] as const).map((k) => ({
    key: k,
    label: RESULT_LABELS[k],
    count: resultCount[k],
    color: RESULT_COLORS[k],
  }))

  // 스프린트별 진행률
  const sprintStats = projects.map((p) => {
    const tcs = testcases.filter((tc) => tc.project_id === p.id)
    const counts: Record<Result, number> = { PASS: 0, FAIL: 0, 'N/T': 0, 'N/A': 0 }
    for (const tc of tcs) {
      const r = (tc.latest_result ?? 'N/T') as Result
      counts[r]++
    }
    const pRate = tcs.length > 0 ? Math.round((counts.PASS / tcs.length) * 100) : 0
    return { project: p, total: tcs.length, counts, passRate: pRate }
  }).sort((a, b) => b.total - a.total)

  // 기능(폴더)별 TC 수
  const domainMap = new Map<string, { name: string; count: number }>()
  for (const tc of testcases) {
    const dom = tc.domains as { name: string } | null
    const key = dom?.name ?? '(폴더 미지정)'
    const cur = domainMap.get(key) ?? { name: key, count: 0 }
    cur.count++
    domainMap.set(key, cur)
  }
  const domainStats = Array.from(domainMap.values()).sort((a, b) => b.count - a.count).slice(0, 15)

  // 지난 7일 활동 (일별 수정 개수)
  const now = new Date()
  const days: { label: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const cnt = testcases.filter((tc) => {
      const u = new Date(tc.updated_at)
      return u >= d && u < next
    }).length
    days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: cnt })
  }
  const maxDayCount = Math.max(1, ...days.map((d) => d.count))

  return (
    <AppShell currentPath="/reports">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Reports</div>
        <h1 className="text-lg font-bold text-gray-900 mt-0.5">리포트</h1>
      </header>

      <main className="p-6 space-y-6">
        {/* 상단 요약 지표 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="총 TC" value={`${totalTcs}`} suffix="개" />
          <StatCard label="Pass 비율" value={`${passRate}`} suffix="%" accent="green" />
          <StatCard label="실행률 (N/T 제외)" value={`${executedRate}`} suffix="%" accent="blue" />
          <StatCard label="실패 (FAIL)" value={`${resultCount.FAIL}`} suffix="개" accent={resultCount.FAIL > 0 ? 'red' : undefined} />
        </div>

        {/* 확인결과 파이차트 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">확인결과 분포</h3>
          <ResultPieChart counts={resultChartData} total={totalTcs} />
          {totalTcs > 0 && <ResultSummaryText counts={resultChartData} total={totalTcs} />}
        </div>

        {/* 지난 7일 활동 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">최근 7일 활동 (일별 TC 수정 건수)</h3>
          <div className="flex items-end justify-between gap-2 h-40 border-b border-gray-100">
            {days.map((d, i) => {
              const h = (d.count / maxDayCount) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-gray-600 font-semibold">{d.count > 0 ? d.count : ''}</div>
                  <div
                    className="w-full bg-yellow-400 rounded-t"
                    style={{ height: `${h}%`, minHeight: d.count > 0 ? 4 : 0 }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2">
            {days.map((d, i) => (
              <div key={i} className="flex-1 text-center text-xs text-gray-500">{d.label}</div>
            ))}
          </div>
        </div>

        {/* 스프린트별 진행률 */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">스프린트별 진행률</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">스프린트</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">TC 수</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">PASS</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">FAIL</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">N/T</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Pass율</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-40">진행 바</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sprintStats.map((s) => (
                <tr key={s.project.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/testcases?project=${s.project.tc_prefix}`} className="text-gray-900 font-medium hover:underline hover:text-yellow-700">
                      {s.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{s.total}</td>
                  <td className="px-4 py-2.5 text-green-700">{s.counts.PASS}</td>
                  <td className="px-4 py-2.5 text-red-700">{s.counts.FAIL}</td>
                  <td className="px-4 py-2.5 text-gray-500">{s.counts['N/T']}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900">{s.passRate}%</td>
                  <td className="px-4 py-2.5">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${s.passRate}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {sprintStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">스프린트 없음</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 기능별 TC 개수 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">기능(폴더)별 TC 개수 · TOP 15</h3>
          {domainStats.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">데이터 없음</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const maxCount = Math.max(...domainStats.map((d) => d.count))
                return domainStats.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-40 text-xs text-gray-700 truncate">{d.name}</div>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-400"
                        style={{ width: `${(d.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-xs text-gray-700 font-semibold">{d.count}</div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>

        {/* 최근 활동 (수정 이력) */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">최근 활동 · 최근 50건</h3>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">활동 없음</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.map((h) => (
                <li key={h.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                  <span className="text-gray-900 font-medium min-w-[60px]">{h.editor_name ?? '-'}</span>
                  <span className="text-gray-700">{h.action}</span>
                  {h.details && <span className="text-gray-500 text-xs font-mono truncate flex-1">{h.details}</span>}
                  <span className="text-gray-400 text-xs font-mono">{formatDateTime(h.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </AppShell>
  )
}

function StatCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string
  value: string
  suffix?: string
  accent?: 'green' | 'blue' | 'red'
}) {
  const color = accent === 'green' ? 'text-green-600'
    : accent === 'blue' ? 'text-blue-600'
    : accent === 'red' ? 'text-red-600'
    : 'text-gray-900'
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={`mt-2 flex items-baseline gap-1 ${color}`}>
        <span className="text-3xl font-bold">{value}</span>
        {suffix && <span className="text-sm text-gray-500 font-medium">{suffix}</span>}
      </div>
    </div>
  )
}
