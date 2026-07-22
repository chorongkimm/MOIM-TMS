import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDateKR as formatDate, formatDateTimeKR as formatDateTime, formatDateWithDayKR, todayStrKR } from '@/lib/formatDate'
import { AppShell } from './_components/AppShell'
import { ResultPieChart, ResultSummaryText } from './_components/ResultPieChart'
import { SprintSummaryList } from './_components/SprintSummaryList'

const STATUS_COLORS: Record<string, string> = {
  정상: 'bg-blue-500',
  완료: 'bg-green-500',
  보류: 'bg-gray-400',
  폐기: 'bg-red-500',
}

const STATUS_TEXT: Record<string, string> = {
  정상: 'text-blue-700',
  완료: 'text-green-700',
  보류: 'text-gray-700',
  폐기: 'text-red-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-400',
  Medium: 'bg-yellow-400',
  High: 'bg-orange-500',
  Critical: 'bg-red-500',
}

export default async function Dashboard() {
  const supabase = await createClient()

  const [projectsRes, testcasesResFull] = await Promise.all([
    supabase.from('projects').select('*').order('created_at'),
    supabase
      .from('testcases')
      .select('id, tc_no, title, priority, type, environment, status, latest_result, jira_link, updated_at, created_at, project_id, projects(name, tc_prefix)')
      .order('updated_at', { ascending: false }),
  ])

  // jira_link 컬럼 없어서 실패한 경우 fallback (마이그레이션 미실행)
  let testcasesRes = testcasesResFull
  if (testcasesResFull.error) {
    console.warn('[dashboard] jira_link 없이 fallback 쿼리 실행:', testcasesResFull.error.message)
    testcasesRes = await supabase
      .from('testcases')
      .select('id, tc_no, title, priority, type, environment, status, latest_result, updated_at, created_at, project_id, projects(name, tc_prefix)')
      .order('updated_at', { ascending: false })
  }

  const projects = projectsRes.data ?? []
  type TCRow = {
    id: string; tc_no: number; title: string; priority: string; type: string;
    environment: string; status: string; latest_result: string | null;
    jira_link?: string | null;
    updated_at: string; created_at: string; project_id: string;
    projects: { name: string; tc_prefix: string } | null;
  }
  const testcases = (testcasesRes.data ?? []) as unknown as TCRow[]

  // 통계 계산
  const totalTcs = testcases.length
  const totalProjects = projects.length

  // 프로젝트별 그룹
  const byProject = new Map<string, typeof testcases>()
  for (const tc of testcases) {
    const arr = byProject.get(tc.project_id) ?? []
    arr.push(tc)
    byProject.set(tc.project_id, arr)
  }

  // 가장 최근 스프린트 찾기 (이름의 숫자가 가장 큰 것)
  function extractLeadingNumber(name: string): number {
    const m = name.match(/(\d+(?:\.\d+)?)/)
    return m ? parseFloat(m[1]) : -Infinity
  }

  // 1) 오늘 날짜가 기간 안에 있는 스프린트가 있으면 그것을 우선 사용
  // 2) 없으면 이름 앞 숫자가 가장 큰 스프린트 (기간 지난 마지막)
  const todayStr = todayStrKR() // KST 오늘 (YYYY-MM-DD)
  const activeSprints = projects.filter((p) => {
    const s = (p.start_date as string | null) ?? null
    const e = (p.end_date as string | null) ?? null
    if (!s && !e) return false
    if (s && todayStr < s) return false
    if (e && todayStr > e) return false
    return true
  })
  const latestSprint = activeSprints.length > 0
    ? [...activeSprints].sort((a, b) => extractLeadingNumber(b.name) - extractLeadingNumber(a.name))[0]
    : [...projects].sort((a, b) => extractLeadingNumber(b.name) - extractLeadingNumber(a.name))[0]
  const isActive = activeSprints.some((p) => p.id === latestSprint?.id)

  // 최근 스프린트만의 확인결과 분포
  // Untested = null (아직 결과 없음), N/T = 명시적으로 'Not Tested' 로 지정
  const resultCount: Record<'PASS' | 'FAIL' | 'N/T' | 'N/A' | 'Untested', number> = {
    PASS: 0, FAIL: 0, 'N/T': 0, 'N/A': 0, Untested: 0,
  }
  const latestSprintTcs = latestSprint
    ? testcases.filter((tc) => tc.project_id === latestSprint.id)
    : []

  // 우선순위 분포 (현재 스프린트 기준)
  const priorityCount: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 }
  for (const tc of latestSprintTcs) {
    priorityCount[tc.priority] = (priorityCount[tc.priority] ?? 0) + 1
  }
  for (const tc of latestSprintTcs) {
    const raw = tc.latest_result
    if (!raw) {
      resultCount.Untested += 1
    } else {
      const key = raw as 'PASS' | 'FAIL' | 'N/T' | 'N/A'
      if (key in resultCount) resultCount[key] += 1
    }
  }

  const RESULT_META: Record<string, { label: string; color: string }> = {
    PASS: { label: 'Passed', color: '#22c55e' },        // 초록
    FAIL: { label: 'Failed', color: '#ef4444' },        // 빨강
    'N/A': { label: 'N/A', color: '#eab308' },          // 노랑
    'N/T': { label: 'N/T', color: '#9ca3af' },          // 회색
    Untested: { label: 'Untested', color: '#ffffff' },  // 흰색 (아직 결과 없음)
  }
  const resultChartData = (['PASS', 'FAIL', 'N/A', 'N/T', 'Untested'] as const).map((k) => ({
    key: k,
    label: RESULT_META[k].label,
    count: resultCount[k],
    color: RESULT_META[k].color,
  }))

  // 오늘 할 일: 아직 결과가 안 나온 TC (N/T + Untested)
  const ntCount = resultCount['N/T'] + resultCount.Untested
  const totalInLatest = latestSprintTcs.length
  const donePct = totalInLatest > 0
    ? Math.round(((totalInLatest - ntCount) / totalInLatest) * 10000) / 100
    : 0

  // 스프린트 진행률: 남은 일수 (오늘 포함 계산은 하지 않음, 순수 남은 날짜 차이)
  const remainingDays = (() => {
    if (!latestSprint || !latestSprint.end_date) return null
    const end = new Date(latestSprint.end_date)  // UTC 자정
    const today = new Date(todayStr)             // UTC 자정
    const diff = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  })()

  // 최근 FAIL TC 리스트 (5개)
  const recentFailTcs = testcases
    .filter((tc) => tc.latest_result === 'FAIL')
    .slice(0, 5)

  // JIRA 링크 없는 FAIL TC
  const failWithoutJira = testcases.filter(
    (tc) => tc.latest_result === 'FAIL' && !tc.jira_link,
  )

  const recentTcs = testcases.slice(0, 10)

  return (
    <AppShell currentPath="/">
      <>
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Overview</div>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">대시보드</h1>
        </header>

        <main className="p-6 space-y-6">
          {/* 진행 중 스프린트 대형 헤더 */}
          {latestSprint && (
            <Link
              href={`/testcases?project=${latestSprint.tc_prefix}`}
              className={`block rounded-xl border-2 p-6 shadow-sm hover:shadow-md transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 hover:border-green-500'
                  : 'bg-gray-50 border-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full ${
                      isActive ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                    }`}
                  >
                    {isActive ? '🟢 진행 중' : '⏹ 종료됨'}
                  </span>
                  <h2 className="text-3xl font-bold text-gray-900">{latestSprint.name}</h2>
                </div>
                {(latestSprint.start_date || latestSprint.end_date) && (
                  <div className="text-lg font-mono text-gray-700">
                    📅 {formatDateWithDayKR(latestSprint.start_date as string | null) || '?'}
                    <span className="mx-2 text-gray-400">~</span>
                    {formatDateWithDayKR(latestSprint.end_date as string | null) || '?'}
                    {isActive && remainingDays !== null && remainingDays >= 0 && (
                      <span className="ml-3 text-sm text-green-700 font-semibold">
                        · {remainingDays}일 남음
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 오늘 할 일 요약 */}
              <div className="mt-4 pt-4 border-t border-gray-200/60 flex items-baseline gap-2">
                <span className="text-sm text-gray-600">오늘 할 일 (미수행):</span>
                <span className={`text-2xl font-bold ${ntCount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{ntCount}</span>
                <span className="text-sm text-gray-500">개</span>
                <span className="text-xs text-gray-400 ml-auto">→ 클릭하여 TC 목록 보기</span>
              </div>
            </Link>
          )}

          {/* 스프린트 진행률 카드 */}
          {latestSprint && totalInLatest > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">진행률</h3>
                <Link
                  href={`/testcases?project=${latestSprint.tc_prefix}`}
                  className="text-xs text-yellow-600 hover:underline font-medium"
                >
                  TC 목록 →
                </Link>
              </div>
              <div className="flex items-center gap-6">
                {/* 원형 진행률 */}
                <div className="relative w-24 h-24 shrink-0">
                  <svg width="96" height="96" className="-rotate-90">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="none"
                      stroke={donePct >= 100 ? '#22c55e' : donePct >= 50 ? '#eab308' : '#f97316'}
                      strokeWidth="10"
                      strokeDasharray={`${(donePct / 100) * 251.2} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-900">{donePct.toFixed(2)}%</span>
                  </div>
                </div>
                {/* 통계 */}
                <div className="flex-1 grid grid-cols-5 gap-2">
                  <div className="text-center py-2 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-700">{resultCount.PASS}</div>
                    <div className="text-xs text-green-600">PASS</div>
                  </div>
                  <div className="text-center py-2 bg-red-50 rounded">
                    <div className="text-lg font-bold text-red-700">{resultCount.FAIL}</div>
                    <div className="text-xs text-red-600">FAIL</div>
                  </div>
                  <div className="text-center py-2 bg-yellow-50 rounded">
                    <div className="text-lg font-bold text-yellow-700">{resultCount['N/A']}</div>
                    <div className="text-xs text-yellow-600">N/A</div>
                  </div>
                  <div className="text-center py-2 bg-gray-100 rounded">
                    <div className="text-lg font-bold text-gray-700">{resultCount['N/T']}</div>
                    <div className="text-xs text-gray-600">N/T</div>
                  </div>
                  <div className="text-center py-2 bg-white border border-gray-200 rounded">
                    <div className="text-lg font-bold text-gray-700">{resultCount.Untested}</div>
                    <div className="text-xs text-gray-500">Untested</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 확인결과 파이차트 (최근 스프린트) + 우선순위 분포 (전체) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">확인결과 분포</h3>
              <ResultPieChart counts={resultChartData} total={latestSprintTcs.length} />
              {latestSprintTcs.length > 0 && <ResultSummaryText counts={resultChartData} total={latestSprintTcs.length} />}
            </div>
            <DistributionCard
              title="우선순위 분포"
              items={(['Critical', 'High', 'Medium', 'Low'] as const).map((k) => ({
                label: k,
                value: priorityCount[k] ?? 0,
                color: PRIORITY_COLORS[k] ?? 'bg-gray-300',
              }))}
              total={latestSprintTcs.length}
            />
          </div>

          {/* FAIL 관련 위젯 (최근 FAIL + JIRA 미연동 FAIL) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 최근 FAIL TC */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">최근 FAIL TC</h3>
                <span className="text-xs text-gray-400">최대 5개</span>
              </div>
              {recentFailTcs.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  🎉 FAIL 이 없어요
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentFailTcs.map((tc) => {
                    const proj = tc.projects as { name: string; tc_prefix: string } | null
                    return (
                      <li key={tc.id}>
                        <Link
                          href={`/testcases/${tc.id}`}
                          className="block px-3 py-2 rounded border border-red-100 bg-red-50/50 hover:bg-red-50 hover:border-red-300 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-200 text-red-800">FAIL</span>
                            <span className="text-xs text-gray-500 truncate">{proj?.name ?? '-'}</span>
                          </div>
                          <div className="text-sm text-gray-900 truncate">{tc.title}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{formatDateTime(tc.updated_at)}</div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* JIRA 링크 없는 FAIL TC */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">JIRA 미연동 FAIL</h3>
                <span className="text-xs text-gray-400">최대 5개</span>
              </div>
              {failWithoutJira.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  ✅ 모든 FAIL 에 JIRA 링크 연결됨
                </div>
              ) : (
                <ul className="space-y-2">
                  {failWithoutJira.slice(0, 5).map((tc) => {
                    const proj = tc.projects as { name: string; tc_prefix: string } | null
                    return (
                      <li key={tc.id}>
                        <Link
                          href={`/testcases/${tc.id}`}
                          className="block px-3 py-2 rounded border border-red-100 bg-red-50/50 hover:bg-red-50 hover:border-red-300 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-200 text-red-800">FAIL</span>
                            <span className="text-xs text-gray-500 truncate">{proj?.name ?? '-'}</span>
                          </div>
                          <div className="text-sm text-gray-900 truncate">{tc.title}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{formatDateTime(tc.updated_at)}</div>
                        </Link>
                      </li>
                    )
                  })}
                  {failWithoutJira.length > 5 && (
                    <li className="text-center text-xs text-gray-400 pt-1">
                      ... 외 {failWithoutJira.length - 5}건
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* 스프린트별 요약 */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">스프린트별 요약</h2>
            <SprintSummaryList
              sprints={projects.map((p) => {
                const tcs = byProject.get(p.id) ?? []
                const doneCount = tcs.filter((tc) => tc.latest_result === 'PASS').length
                return {
                  id: p.id,
                  name: p.name,
                  tc_prefix: p.tc_prefix,
                  tcs_count: tcs.length,
                  done_count: doneCount,
                }
              })}
            />
          </section>

          {/* 최근 수정 TC */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">최근 수정된 TC</h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">스프린트</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">제목</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">수정일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTcs.map((tc) => {
                    const proj = tc.projects as { name: string; tc_prefix: string } | null
                    return (
                      <tr key={tc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/testcases/${tc.id}`} className="text-gray-500 font-mono text-xs hover:text-black hover:underline">
                            NO_{String(tc.tc_no).padStart(3, '0')}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 text-xs">{proj?.name ?? '-'}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/testcases/${tc.id}`} className="hover:underline hover:text-yellow-700 font-medium">
                            {tc.title}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {formatDateTime(tc.updated_at)}
                        </td>
                      </tr>
                    )
                  })}
                  {recentTcs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-400 text-sm">
                        아직 TC가 없어요
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </>
    </AppShell>
  )
}

function SummaryCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string
  value: number
  suffix?: string
  accent?: 'blue' | 'green'
}) {
  const accentClass =
    accent === 'blue' ? 'text-blue-600' :
    accent === 'green' ? 'text-green-600' :
    'text-gray-900'
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={`mt-2 flex items-baseline gap-1 ${accentClass}`}>
        <span className="text-3xl font-bold">{value}</span>
        {suffix && <span className="text-sm text-gray-500 font-medium">{suffix}</span>}
      </div>
    </div>
  )
}

function DistributionCard({
  title,
  items,
  total,
}: {
  title: string
  items: { label: string; value: number; color: string }[]
  total: number
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {total === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">데이터 없음</div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const pct = total > 0 ? Math.round((it.value / total) * 100) : 0
            return (
              <div key={it.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{it.label}</span>
                  <span className="text-gray-500">{it.value}건 <span className="text-gray-400">({pct}%)</span></span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden bg-gray-100">
                  <div className={`h-full ${it.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
