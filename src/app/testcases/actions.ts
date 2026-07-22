'use server'

import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const DEFAULT_EDITOR = '김초롱'  // 로컬 개발용, 나중에 인증 붙이면 실제 사용자로 교체

function slugPrefix(name: string): string {
  const alnum = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (alnum.length >= 3) return alnum.slice(0, 3)
  // Fallback: use timestamp-based short code
  return 'P' + Date.now().toString(36).slice(-3).toUpperCase()
}

export async function createTestcase(formData: FormData): Promise<{ projectPrefix: string; tcNo: number }> {
  const supabase = await createClient()

  const projectName = String(formData.get('project_name') ?? '').trim()
  const projectPrefixInput = String(formData.get('project_prefix') ?? '').trim().toUpperCase()
  const title = String(formData.get('title') ?? '').trim()
  const priority = String(formData.get('priority') ?? 'Medium')
  const type = String(formData.get('type') ?? '기능')
  const environment = String(formData.get('environment') ?? 'Staging')
  const status = String(formData.get('status') ?? '정상')
  const precondition = String(formData.get('precondition') ?? '').trim() || null
  const procedure = String(formData.get('procedure') ?? '').trim() || null
  const expected = String(formData.get('expected') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  const authorName = String(formData.get('author_name') ?? '').trim() || DEFAULT_EDITOR

  if (!projectName || !title) {
    throw new Error('프로젝트명과 제목은 필수입니다')
  }

  // 기존 프로젝트 찾기 (이름 일치)
  const { data: existing } = await supabase
    .from('projects')
    .select('id, tc_prefix')
    .eq('name', projectName)
    .maybeSingle()

  let projectId: string
  let finalProjectPrefix: string
  if (existing) {
    projectId = existing.id
    finalProjectPrefix = existing.tc_prefix
  } else {
    // 신규 프로젝트 생성
    const prefix = projectPrefixInput || slugPrefix(projectName)

    // prefix 중복 회피 (같은 prefix 있으면 뒤에 숫자 붙이기)
    let finalPrefix = prefix
    for (let i = 2; i <= 99; i++) {
      const { data: dup } = await supabase
        .from('projects')
        .select('id')
        .eq('tc_prefix', finalPrefix)
        .maybeSingle()
      if (!dup) break
      finalPrefix = prefix + i
    }

    const { data: created, error: projErr } = await supabase
      .from('projects')
      .insert({ name: projectName, tc_prefix: finalPrefix })
      .select('id, tc_prefix')
      .single()

    if (projErr || !created) {
      throw new Error(`프로젝트 생성 실패: ${projErr?.message ?? 'unknown'}`)
    }
    projectId = created.id
    finalProjectPrefix = created.tc_prefix
  }

  // 프로젝트에 도메인 하나도 없으면 '기본' 폴더 자동 생성
  // 있으면 첫 번째(sort_order 낮은) 도메인 재사용
  const { data: firstDomain } = await supabase
    .from('domains')
    .select('id')
    .eq('project_id', projectId)
    .is('parent_id', null)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  let defaultDomainId: string
  if (firstDomain) {
    defaultDomainId = firstDomain.id
  } else {
    const { data: newDomain, error: dErr } = await supabase
      .from('domains')
      .insert({ project_id: projectId, name: '기본', sort_order: 1 })
      .select('id')
      .single()
    if (dErr || !newDomain) {
      throw new Error(`기본 폴더 생성 실패: ${dErr?.message ?? 'unknown'}`)
    }
    defaultDomainId = newDomain.id
  }

  // 해당 프로젝트의 마지막 tc_no + 1
  const { data: last } = await supabase
    .from('testcases')
    .select('tc_no')
    .eq('project_id', projectId)
    .order('tc_no', { ascending: false })
    .limit(1)

  const nextNo = (last?.[0]?.tc_no ?? 0) + 1

  const { error } = await supabase.from('testcases').insert({
    project_id: projectId,
    domain_id: defaultDomainId,
    tc_no: nextNo,
    title,
    priority,
    type,
    environment,
    status,
    precondition,
    procedure,
    expected,
    notes,
    author_name: authorName,
  })

  if (error) {
    throw new Error(`TC 저장 실패: ${error.message}`)
  }

  revalidatePath('/testcases')
  revalidatePath('/')
  return { projectPrefix: finalProjectPrefix, tcNo: nextNo }
}

export async function updateTestcase(id: string, formData: FormData) {
  const supabase = await createClient()

  const title = String(formData.get('title') ?? '').trim()
  const priority = String(formData.get('priority') ?? 'Medium')
  const type = String(formData.get('type') ?? '기능')
  const environment = String(formData.get('environment') ?? 'Staging')
  const status = String(formData.get('status') ?? '정상')
  const precondition = String(formData.get('precondition') ?? '').trim() || null
  const procedure = String(formData.get('procedure') ?? '').trim() || null
  const expected = String(formData.get('expected') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  const authorName = String(formData.get('author_name') ?? '').trim() || DEFAULT_EDITOR
  const editorName = String(formData.get('editor_name') ?? '').trim() || null

  if (!title) throw new Error('제목은 필수입니다')

  const { error } = await supabase
    .from('testcases')
    .update({
      title,
      priority,
      type,
      environment,
      status,
      precondition,
      procedure,
      expected,
      notes,
      author_name: authorName,
    })
    .eq('id', id)

  if (error) throw new Error(`수정 실패: ${error.message}`)

  await logHistory(supabase, id, '수정', '기본 정보 및 내용 변경', editorName)

  revalidatePath('/testcases')
  revalidatePath('/')
  revalidatePath(`/testcases/${id}`)
}

// TC 타입(기능/예외/UI/회귀) 인라인 변경
export async function updateTestcaseType(id: string, type: string): Promise<void> {
  if (!ALLOWED_TYPE.has(type)) throw new Error(`유효하지 않은 타입: ${type}`)
  const supabase = await createClient()
  const { data: prev } = await supabase.from('testcases').select('type').eq('id', id).maybeSingle()
  const { error } = await supabase.from('testcases').update({ type }).eq('id', id)
  if (error) throw new Error(`타입 저장 실패: ${error.message}`)
  await logHistory(supabase, id, '타입 변경', `${prev?.type ?? '(없음)'} → ${type}`)
  revalidatePath('/testcases')
  revalidatePath(`/testcases/${id}`)
}

// JIRA 링크 인라인 편집
export async function updateTestcaseJiraLink(id: string, link: string): Promise<void> {
  const trimmed = link.trim()
  const value = trimmed || null
  const supabase = await createClient()
  const { data: prev } = await supabase.from('testcases').select('jira_link').eq('id', id).maybeSingle()
  const { error } = await supabase.from('testcases').update({ jira_link: value }).eq('id', id)
  if (error) throw new Error(`JIRA 링크 저장 실패: ${error.message}`)
  await logHistory(supabase, id, 'JIRA 링크 변경', `${(prev as { jira_link?: string | null } | null)?.jira_link ?? '(없음)'} → ${value ?? '(없음)'}`)
  revalidatePath('/testcases')
  revalidatePath(`/testcases/${id}`)
}

// TC 상세 사이드 패널용: TC + 코멘트 + 이력 한번에 조회
export async function getTestcaseFullDetail(id: string): Promise<{
  tc: unknown
  tcCode: string
  comments: unknown[]
  history: unknown[]
} | null> {
  const supabase = await createClient()
  const { data: tc } = await supabase
    .from('testcases')
    .select('*, projects(name, tc_prefix), domains(id, name)')
    .eq('id', id)
    .maybeSingle()
  if (!tc) return null

  const [commentsRes, historyRes] = await Promise.all([
    supabase.from('tc_comments').select('*').eq('testcase_id', id).order('created_at', { ascending: false }),
    supabase.from('tc_edit_history').select('*').eq('testcase_id', id).order('created_at', { ascending: false }),
  ])

  const tcNo = (tc as { tc_no?: number }).tc_no ?? 0
  return {
    tc,
    tcCode: `NO_${String(tcNo).padStart(3, '0')}`,
    comments: commentsRes.data ?? [],
    history: historyRes.data ?? [],
  }
}

// 폴더에 여러 TC 한번에 생성 (엑셀 붙여넣기용)
export type BulkTcInput = {
  title: string
  precondition?: string
  procedure?: string
  expected?: string
  priority?: string
  type?: string
  environment?: string
}

export async function createManyTestcases(
  projectId: string,
  domainId: string | null,
  items: BulkTcInput[],
): Promise<{ created: number; errors: string[] }> {
  const supabase = await createClient()

  // 프로젝트 내 다음 tc_no 시작값
  const { data: last } = await supabase
    .from('testcases')
    .select('tc_no')
    .eq('project_id', projectId)
    .order('tc_no', { ascending: false })
    .limit(1)
  let nextNo = (last?.[0]?.tc_no ?? 0) + 1

  const errors: string[] = []
  let created = 0

  for (const item of items) {
    const title = item.title?.trim()
    if (!title) continue // 빈 행 스킵

    const priority = ALLOWED_PRIORITY.has(item.priority ?? '') ? item.priority! : 'Medium'
    const type = ALLOWED_TYPE.has(item.type ?? '') ? item.type! : '기능'
    const environment = item.environment?.trim() || 'Staging'

    const { error } = await supabase.from('testcases').insert({
      project_id: projectId,
      domain_id: domainId,
      tc_no: nextNo,
      title,
      priority,
      type,
      environment,
      status: '정상',
      precondition: item.precondition?.trim() || null,
      procedure: item.procedure?.trim() || null,
      expected: item.expected?.trim() || null,
      author_name: DEFAULT_EDITOR,
      latest_result: null,
    })

    if (error) {
      errors.push(`${title.slice(0, 30)}: ${error.message}`)
    } else {
      created++
      nextNo++
    }
  }

  revalidatePath('/testcases')
  revalidatePath('/')
  return { created, errors }
}

export async function deleteTestcase(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('testcases').delete().eq('id', id)
  if (error) throw new Error(`삭제 실패: ${error.message}`)
  revalidatePath('/testcases')
  revalidatePath('/')
}

export async function duplicateTestcase(id: string): Promise<{ newId: string }> {
  const supabase = await createClient()

  const { data: src, error: fErr } = await supabase
    .from('testcases')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fErr || !src) throw new Error(`원본 TC를 찾을 수 없어요`)

  // 프로젝트 내 다음 tc_no
  const { data: last } = await supabase
    .from('testcases')
    .select('tc_no')
    .eq('project_id', src.project_id)
    .order('tc_no', { ascending: false })
    .limit(1)
  const nextNo = (last?.[0]?.tc_no ?? 0) + 1

  const { data: created, error: iErr } = await supabase
    .from('testcases')
    .insert({
      project_id: src.project_id,
      domain_id: src.domain_id,
      tc_no: nextNo,
      title: `${src.title} (복사본)`,
      priority: src.priority,
      type: src.type,
      environment: src.environment,
      status: src.status,
      precondition: src.precondition,
      procedure: src.procedure,
      expected: src.expected,
      notes: src.notes,
      author_name: src.author_name,
      latest_result: null,
    })
    .select('id')
    .single()

  if (iErr || !created) throw new Error(`복제 실패: ${iErr?.message ?? ''}`)

  revalidatePath('/testcases')
  revalidatePath('/')
  return { newId: created.id }
}

export async function deleteTestcases(ids: string[]): Promise<{ count: number }> {
  if (ids.length === 0) return { count: 0 }
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('testcases')
    .delete({ count: 'exact' })
    .in('id', ids)
  if (error) throw new Error(`TC 삭제 실패: ${error.message}`)
  revalidatePath('/testcases')
  revalidatePath('/')
  revalidatePath('/test-runs')
  return { count: count ?? ids.length }
}

const ALLOWED_RESULTS = new Set(['PASS', 'FAIL', 'N/T', 'N/A'])

const EDITABLE_TEXT_FIELDS = new Set(['title', 'precondition', 'procedure', 'expected', 'notes'])
const FIELD_LABELS: Record<string, string> = {
  title: '제목',
  precondition: '사전조건',
  procedure: '재현절차',
  expected: '기대결과',
  notes: '비고',
}

function truncate(s: string | null | undefined, max = 80): string {
  if (!s) return '(빈 값)'
  const oneLine = s.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return `"${oneLine}"`
  return `"${oneLine.slice(0, max)}…"`
}

export async function updateTestcaseField(
  id: string,
  field: string,
  value: string,
): Promise<void> {
  if (!EDITABLE_TEXT_FIELDS.has(field)) {
    throw new Error(`허용되지 않은 필드: ${field}`)
  }
  const trimmed = value.trim()
  if (field === 'title' && !trimmed) {
    throw new Error('제목은 비울 수 없습니다')
  }

  const supabase = await createClient()

  // 이전 값 조회 (before/after 로깅용)
  const { data: prev } = await supabase
    .from('testcases')
    .select(field)
    .eq('id', id)
    .maybeSingle()
  const oldVal = prev ? (prev as unknown as Record<string, string | null>)[field] : null
  const newVal = trimmed || null

  const updateData: Record<string, string | null> = {}
  updateData[field] = newVal

  const { error } = await supabase.from('testcases').update(updateData).eq('id', id)
  if (error) throw new Error(`저장 실패: ${error.message}`)

  // 값이 같으면 로그 남기지 않음
  if (oldVal !== newVal) {
    const details = `${truncate(oldVal)} → ${truncate(newVal)}`
    await logHistory(supabase, id, `${FIELD_LABELS[field]} 변경`, details)
  }

  revalidatePath('/testcases')
  revalidatePath('/')
  revalidatePath(`/testcases/${id}`)
}

const ALLOWED_PRIORITIES = new Set(['Low', 'Medium', 'High', 'Critical'])

async function logHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  testcaseId: string,
  action: string,
  details: string | null,
  editorName?: string | null,
) {
  const { error } = await supabase.from('tc_edit_history').insert({
    testcase_id: testcaseId,
    action,
    details,
    editor_name: (editorName && editorName.trim()) || DEFAULT_EDITOR,
  })
  if (error) {
    // 서버 콘솔에 로그. 마이그레이션 미실행 등의 상황을 개발자가 알 수 있도록.
    console.error('[logHistory] 실패:', error.message)
  }
}

export async function createComment(
  testcaseId: string,
  content: string,
): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('코멘트 내용을 입력하세요')
  if (trimmed.length > 5000) throw new Error('코멘트가 너무 깁니다 (5000자 이하)')

  const supabase = await createClient()
  const { error } = await supabase.from('tc_comments').insert({
    testcase_id: testcaseId,
    author_name: DEFAULT_EDITOR,  // 로컬 환경: 항상 김초롱
    content: trimmed,
  })
  if (error) throw new Error(`코멘트 저장 실패: ${error.message}`)

  revalidatePath(`/testcases/${testcaseId}`)
}

export async function deleteComment(id: string, testcaseId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('tc_comments').delete().eq('id', id)
  if (error) throw new Error(`코멘트 삭제 실패: ${error.message}`)
  revalidatePath(`/testcases/${testcaseId}`)
}

const ALLOWED_EXECUTION_STATUSES = new Set(['대기', '진행중', '완료', '홀드', '재검토'])

export async function updateTestcaseExecutionStatus(
  id: string,
  status: string | null,
): Promise<void> {
  const value = status && ALLOWED_EXECUTION_STATUSES.has(status) ? status : null
  const supabase = await createClient()
  const { data: prev } = await supabase
    .from('testcases')
    .select('execution_status')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('testcases')
    .update({ execution_status: value })
    .eq('id', id)
  if (error) throw new Error(`수행 상태 저장 실패: ${error.message}`)

  const oldV = (prev as { execution_status?: string | null } | null)?.execution_status ?? '(없음)'
  const newV = value ?? '(없음)'
  await logHistory(supabase, id, '수행 상태 변경', `${oldV} → ${newV}`)

  revalidatePath('/testcases')
  revalidatePath('/')
  revalidatePath(`/testcases/${id}`)
}

const ALLOWED_ENVIRONMENTS = new Set(['Staging', 'Dev', 'Prod'])

export async function updateTestcaseEnvironment(id: string, environment: string): Promise<void> {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(`유효하지 않은 환경: ${environment}`)
  }
  const supabase = await createClient()
  const { data: prev } = await supabase.from('testcases').select('environment').eq('id', id).maybeSingle()
  const { error } = await supabase
    .from('testcases')
    .update({ environment })
    .eq('id', id)
  if (error) throw new Error(`환경 저장 실패: ${error.message}`)

  await logHistory(supabase, id, '환경 변경', `${prev?.environment ?? '?'} → ${environment}`)

  revalidatePath('/testcases')
  revalidatePath('/')
  revalidatePath(`/testcases/${id}`)
}

export async function updateTestcasePriority(id: string, priority: string): Promise<void> {
  if (!ALLOWED_PRIORITIES.has(priority)) {
    throw new Error(`유효하지 않은 우선순위: ${priority}`)
  }
  const supabase = await createClient()
  const { data: prev } = await supabase.from('testcases').select('priority').eq('id', id).maybeSingle()
  const { error } = await supabase
    .from('testcases')
    .update({ priority })
    .eq('id', id)
  if (error) throw new Error(`우선순위 저장 실패: ${error.message}`)

  await logHistory(supabase, id, '우선순위 변경', `${prev?.priority ?? '?'} → ${priority}`)

  revalidatePath('/testcases')
  revalidatePath('/')
  revalidatePath(`/testcases/${id}`)
}

// 폴더에 속한 TC들의 확인결과가 모두 채워졌으면(N/T 없음) 폴더 색을 'sky'(TC 수행 완료)로 자동 설정.
// 하나라도 N/T 이거나 결과가 없으면 아무 것도 안 함 (기존 색 유지).
async function autoPromoteFolderIfAllDone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  domainId: string | null | undefined,
): Promise<void> {
  if (!domainId) return
  const { data: tcs, error } = await supabase
    .from('testcases')
    .select('latest_result')
    .eq('domain_id', domainId)
  if (error || !tcs || tcs.length === 0) return

  const allDone = tcs.every((t) => {
    const r = (t as { latest_result?: string | null }).latest_result
    return !!r && r !== 'N/T'
  })
  if (!allDone) return

  await supabase.from('domains').update({ color: 'sky' }).eq('id', domainId)
}

export async function updateTestcaseResult(id: string, result: string): Promise<void> {
  if (!ALLOWED_RESULTS.has(result)) {
    throw new Error(`유효하지 않은 결과: ${result}`)
  }
  const supabase = await createClient()
  const { data: prev } = await supabase.from('testcases').select('latest_result, domain_id').eq('id', id).maybeSingle()
  const { error } = await supabase
    .from('testcases')
    .update({ latest_result: result })
    .eq('id', id)
  if (error) throw new Error(`결과 저장 실패: ${error.message}`)

  await logHistory(supabase, id, '확인결과 변경', `${prev?.latest_result ?? '(없음)'} → ${result}`)

  // 소속 폴더의 모든 TC가 완료 상태면 폴더도 '수행 완료'로
  const domainId = (prev as { domain_id?: string | null } | null)?.domain_id ?? null
  await autoPromoteFolderIfAllDone(supabase, domainId)

  revalidatePath('/testcases')
  revalidatePath('/test-runs')
  revalidatePath('/')
  revalidatePath(`/testcases/${id}`)
}

const ALLOWED_PRIORITY = new Set(['Low', 'Medium', 'High', 'Critical'])
const ALLOWED_TYPE = new Set(['기능', '예외', 'UI', '회귀'])
const ALLOWED_STATUS = new Set(['정상', '완료', '보류', '폐기'])

function normalize(val: unknown): string {
  if (val === undefined || val === null) return ''
  // ExcelJS RichText 또는 hyperlink 셀 대응
  if (typeof val === 'object' && val !== null) {
    const v = val as { text?: string; result?: string }
    if (typeof v.text === 'string') return v.text.trim()
    if (typeof v.result === 'string') return v.result.trim()
  }
  return String(val).trim()
}

type SheetImportResult = {
  ok: number
  fail: number
  errors: string[]
  nextNo: number
}

// 시트 하나에서 헤더 위치 찾기 (1~10행 사이 스캔, 키워드 포함 여부로 판단)
function findHeaderRow(sheet: ExcelJS.Worksheet): { rowNumber: number; headers: string[] } | null {
  const HEADER_KEYWORDS = [
    '확인절차', '확인 절차', '재현절차', '재현 절차', '재현스텝', '재현 스텝', '테스트 스텝', '스텝', 'Steps', 'Procedure',
    '기대결과', '기대 결과', '예상결과', '예상 결과', 'Expected', 'Result',
    '제목', 'Title', 'Summary',
    '사전조건', '사전 조건', 'Preconditions', 'Precondition',
  ]
  const maxScan = Math.min(sheet.lastRow?.number ?? 1, 10)
  for (let r = 1; r <= maxScan; r++) {
    const row = sheet.getRow(r)
    const headers: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = normalize(cell.value)
    })
    const hasKeyword = headers.some((h) => HEADER_KEYWORDS.includes(h))
    if (hasKeyword) return { rowNumber: r, headers }
  }
  return null
}

// 시트에서 TC 데이터를 추출하는 헬퍼
async function importOneSheet(
  sheet: ExcelJS.Worksheet,
  projectId: string,
  domainId: string | null,
  startNo: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SheetImportResult> {
  const header = findHeaderRow(sheet)
  if (!header) {
    // 헤더 진단 - 서버 콘솔에 첫 3행 내용 출력
    console.log(`[import] "${sheet.name}" 헤더 못 찾음. 첫 3행 내용:`)
    for (let r = 1; r <= Math.min(3, sheet.lastRow?.number ?? 1); r++) {
      const row = sheet.getRow(r)
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = normalize(cell.value)
      })
      console.log(`  row ${r}:`, cells)
    }
    return {
      ok: 0,
      fail: 0,
      errors: [`[${sheet.name}] 헤더(제목/확인절차/기대결과 등)를 못 찾아 건너뜀. 서버 콘솔에서 시트 내용 확인 가능`],
      nextNo: startNo,
    }
  }

  const { rowNumber: headerRowNo, headers } = header
  console.log(`[import] "${sheet.name}" 헤더 발견 (row ${headerRowNo}):`, headers.filter((h) => h))
  const colIndex = (label: string): number => headers.findIndex((h) => h === label)

  const idxId = 0 // 첫 번째 컬럼은 대체로 ID
  const idxTitle = colIndex('제목')
  const idxPriority = colIndex('우선순위')
  const idxType = colIndex('유형')
  const idxEnv = colIndex('환경')
  const idxStatus = colIndex('상태')
  const idxPre = colIndex('사전조건')
  const idxProc = colIndex('확인절차')
  const idxExp = colIndex('기대결과')
  const idxAuthor = colIndex('작성자')
  const idxNotes = colIndex('비고')
  const idxResult = colIndex('확인결과')

  let ok = 0
  let fail = 0
  const errors: string[] = []
  let nextNo = startNo

  const lastRow = sheet.lastRow?.number ?? headerRowNo
  let scannedRows = 0
  let skippedRows = 0
  for (let r = headerRowNo + 1; r <= lastRow; r++) {
    scannedRows++
    const row = sheet.getRow(r)
    const cellValue = (idx: number) => (idx >= 0 ? normalize(row.getCell(idx + 1).value) : '')

    const idText = normalize(row.getCell(idxId + 1).value)

    // A열에 ID로 볼 만한 값이 있는 행만 TC로 인정
    // - ▶ (섹션 헤더), 빈 셀 → 스킵
    // - "NO_001", "TC-001", "001", "1" 등 다양한 형식 허용
    // - 확인절차·기대결과 같은 텍스트가 A열에 들어간 경우도 스킵 (헤더 반복 방지)
    if (!idText) { skippedRows++; continue }
    if (idText.startsWith('▶')) { skippedRows++; continue }
    // ID처럼 보이는지: 숫자가 하나라도 포함되어 있으면 ID로 인정
    // (NO_001, TC-01, RA_2, OverseasAddressApp_1, 001, 1 등 모두 매치)
    const looksLikeId = /\d/.test(idText)
    if (!looksLikeId) {
      if (skippedRows < 3) console.log(`[import]   "${sheet.name}" row ${r} ID열 값 "${idText.slice(0, 40)}" - ID 아님, 스킵`)
      skippedRows++
      continue
    }

    // 명시적 제목 컬럼이 있으면 그것 사용
    let title = idxTitle >= 0 ? cellValue(idxTitle) : ''

    const procedure = cellValue(idxProc)
    const expected = cellValue(idxExp)
    const precondition = cellValue(idxPre)

    // 제목이 없으면: 확인절차 첫 줄 → 기대결과 첫 줄 → ID 순으로 대체
    if (!title) {
      title = (procedure || expected || idText).split('\n')[0].trim().slice(0, 200)
    }

    if (!title) {
      fail++
      errors.push(`[${sheet.name}] 행 ${r} (${idText}): 제목 만들 수 없음`)
      continue
    }

    let priority = cellValue(idxPriority) || 'Medium'
    if (!ALLOWED_PRIORITY.has(priority)) priority = 'Medium'
    let type = cellValue(idxType) || '수동'
    if (!ALLOWED_TYPE.has(type)) type = '수동'
    let status = cellValue(idxStatus) || '정상'
    if (!ALLOWED_STATUS.has(status)) status = '정상'
    const environment = cellValue(idxEnv) || 'Staging'
    const authorName = cellValue(idxAuthor) || DEFAULT_EDITOR
    const notes = cellValue(idxNotes) || null

    // 확인결과 - 파일에 값이 있고 허용값이면 반영, 없으면 'N/T'
    const rawResult = cellValue(idxResult).toUpperCase()
    const latestResult = ALLOWED_RESULTS.has(rawResult) ? rawResult : null

    const { error: iErr } = await supabase.from('testcases').insert({
      project_id: projectId,
      domain_id: domainId,
      tc_no: nextNo,
      title,
      priority,
      type,
      environment,
      status,
      precondition: precondition || null,
      procedure: procedure || null,
      expected: expected || null,
      notes,
      author_name: authorName,
      latest_result: latestResult,
    })

    if (iErr) {
      fail++
      errors.push(`[${sheet.name}] 행 ${r} (${title.slice(0, 30)}): ${iErr.message}`)
    } else {
      ok++
      nextNo++
    }
  }

  console.log(`[import] "${sheet.name}" 결과: ${ok}건 저장, ${fail}건 실패, ${skippedRows}행 스킵 (총 ${scannedRows}행 스캔)`)
  return { ok, fail, errors, nextNo }
}

export async function importTestcasesXlsx(formData: FormData): Promise<{
  ok: number
  fail: number
  folders: { name: string; count: number }[]
  errors: string[]
}> {
  const file = formData.get('file') as File | null
  const targetProjectName = String(formData.get('target_project_name') ?? '').trim()

  if (!file || file.size === 0) {
    throw new Error('XLSX 파일을 선택해 주세요')
  }
  if (!targetProjectName) {
    throw new Error('저장할 프로젝트(스프린트)를 지정해 주세요')
  }

  const arrayBuffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(arrayBuffer)
  } catch {
    throw new Error('XLSX 파일을 열 수 없습니다. 파일이 손상됐거나 형식이 맞지 않습니다.')
  }

  if (wb.worksheets.length === 0) {
    throw new Error('시트가 없습니다')
  }

  const supabase = await createClient()

  // 타깃 프로젝트 확인 (없으면 새로 생성)
  let projectId: string
  const { data: existing } = await supabase
    .from('projects')
    .select('id, tc_prefix')
    .eq('name', targetProjectName)
    .maybeSingle()

  if (existing) {
    projectId = existing.id
  } else {
    const alnum = targetProjectName.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const basePrefix = alnum.length >= 3 ? alnum.slice(0, 3) : 'P' + Date.now().toString(36).slice(-3).toUpperCase()
    let finalPrefix = basePrefix
    for (let i = 2; i <= 99; i++) {
      const { data: dup } = await supabase
        .from('projects')
        .select('id')
        .eq('tc_prefix', finalPrefix)
        .maybeSingle()
      if (!dup) break
      finalPrefix = basePrefix + i
    }
    const { data: created, error: pErr } = await supabase
      .from('projects')
      .insert({ name: targetProjectName, tc_prefix: finalPrefix })
      .select('id')
      .single()
    if (pErr || !created) throw new Error(`프로젝트 생성 실패: ${pErr?.message ?? ''}`)
    projectId = created.id
  }

  // 현재 max tc_no 로 시작
  const { data: last } = await supabase
    .from('testcases')
    .select('tc_no')
    .eq('project_id', projectId)
    .order('tc_no', { ascending: false })
    .limit(1)
  let nextNo = (last?.[0]?.tc_no ?? 0) + 1

  // 요약·정보 시트는 스킵
  const SKIP_SHEETS = new Set([
    '개요', 'Overview', 'overview', '요약',
    '테스트정보', '테스트 정보', 'Info', 'info', '정보',
    '표지', '목차', 'TOC',
  ])
  const targetSheets = wb.worksheets.filter((s) => !SKIP_SHEETS.has(s.name.trim()))

  console.log(`[import] 워크북 시트 총 ${wb.worksheets.length}개:`, wb.worksheets.map((s) => s.name))
  console.log(`[import] 스킵 후 처리 대상 ${targetSheets.length}개:`, targetSheets.map((s) => s.name))

  const results = { ok: 0, fail: 0, folders: [] as { name: string; count: number }[], errors: [] as string[] }

  // 이 프로젝트에서 이미 사용 중인 sort_order 최댓값 조회 → 뒤에 이어 붙이기
  const { data: maxSortRow } = await supabase
    .from('domains')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
  let nextSort = ((maxSortRow?.[0]?.sort_order as number | undefined) ?? 0) + 1

  for (let i = 0; i < targetSheets.length; i++) {
    const sheet = targetSheets[i]
    const sheetName = sheet.name.trim()

    const { data: existingDomain } = await supabase
      .from('domains')
      .select('id, sort_order')
      .eq('project_id', projectId)
      .eq('name', sheetName)
      .is('parent_id', null)
      .maybeSingle()

    let domainId: string
    if (existingDomain) {
      domainId = existingDomain.id
    } else {
      const { data: newDomain, error: dErr } = await supabase
        .from('domains')
        .insert({ project_id: projectId, name: sheetName, sort_order: nextSort++ })
        .select('id')
        .single()
      if (dErr || !newDomain) {
        results.errors.push(`[${sheetName}] 도메인 생성 실패: ${dErr?.message ?? ''}`)
        continue
      }
      domainId = newDomain.id
    }

    const sheetResult = await importOneSheet(sheet, projectId, domainId, nextNo, supabase)
    results.ok += sheetResult.ok
    results.fail += sheetResult.fail
    results.errors.push(...sheetResult.errors)
    if (sheetResult.ok > 0) {
      results.folders.push({ name: sheetName, count: sheetResult.ok })
      // 시트에 확인결과가 모두 채워져 있었다면 폴더 자동 승격
      await autoPromoteFolderIfAllDone(supabase, domainId)
    }
    nextNo = sheetResult.nextNo
  }

  revalidatePath('/testcases')
  revalidatePath('/')

  return {
    ok: results.ok,
    fail: results.fail,
    folders: results.folders,
    errors: results.errors.slice(0, 30),
  }
}


// ─────────────────────────────────────────────────────────
// 확인결과 동기화: xlsx 업로드 → 기존 TC의 latest_result 만 업데이트
// (TC 새로 생성 X, 도메인 새로 생성 X)
// 매칭: 1) (시트명 = 폴더명, 제목 완전일치) → 2) 제목만 프로젝트 전체에서 유일하면 사용
// ─────────────────────────────────────────────────────────

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

export async function syncResultsFromXlsx(formData: FormData): Promise<{
  updated: number
  skippedSheets: { sheet: string; reason: string }[]
  notFound: { sheet: string; title: string; result: string; reason: string }[]
  errors: string[]
}> {
  const file = formData.get('file') as File | null
  const targetProjectName = String(formData.get('target_project_name') ?? '').trim()

  if (!file || file.size === 0) throw new Error('XLSX 파일을 선택해 주세요')
  if (!targetProjectName) throw new Error('대상 스프린트를 선택해 주세요')

  const arrayBuffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(arrayBuffer)
  } catch {
    throw new Error('XLSX 파일을 열 수 없습니다.')
  }

  const supabase = await createClient()
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('id')
    .eq('name', targetProjectName)
    .maybeSingle()

  if (pErr || !project) throw new Error(`스프린트 "${targetProjectName}" 찾을 수 없음`)
  const projectId = project.id as string

  const { data: allTc, error: tErr } = await supabase
    .from('testcases')
    .select('id, title, domain_id, domains(name)')
    .eq('project_id', projectId)
  if (tErr) throw new Error(`TC 조회 실패: ${tErr.message}`)

  // (도메인명, 제목) 정규화 조합 맵 + 제목만 맵 (중복 카운트 함께 저장)
  const tcByDomainAndTitle = new Map<string, string>()  // "domain|title" → id
  const tcByTitle = new Map<string, string[]>()          // "title" → [ids]
  const knownFolders = new Set<string>()

  for (const t of allTc ?? []) {
    const dom = (t as { domains?: { name?: string } | { name?: string }[] | null }).domains
    const domName = Array.isArray(dom) ? (dom[0]?.name ?? '') : (dom?.name ?? '')
    const normDom = normalizeText(domName)
    const normTitle = normalizeText(t.title ?? '')
    knownFolders.add(normDom)
    tcByDomainAndTitle.set(`${normDom}|${normTitle}`, t.id as string)
    const arr = tcByTitle.get(normTitle) ?? []
    arr.push(t.id as string)
    tcByTitle.set(normTitle, arr)
  }

  const SKIP_SHEETS_SET = new Set([
    '개요', 'Overview', '요약', 'Summary', '표지', '목차', 'TOC',
    '테스트정보', '테스트 정보', '정보', 'Info',
  ])

  let updated = 0
  const skippedSheets: { sheet: string; reason: string }[] = []
  const notFound: { sheet: string; title: string; result: string; reason: string }[] = []
  const errors: string[] = []
  const touchedDomainIds = new Set<string>()

  // TC id → domain_id 맵 (자동 승격용)
  const tcIdToDomain = new Map<string, string | null>()
  for (const t of allTc ?? []) {
    tcIdToDomain.set(t.id as string, (t as { domain_id?: string | null }).domain_id ?? null)
  }

  for (const sheet of wb.worksheets) {
    // 개요/요약 등 시스템 시트는 원래 건너뛰는 정상 동작 - 결과에 표시 안 함
    if (SKIP_SHEETS_SET.has(sheet.name)) continue
    const header = findHeaderRow(sheet)
    if (!header) {
      skippedSheets.push({ sheet: sheet.name, reason: '헤더 못 찾음 (제목/확인절차/기대결과 등 키워드가 상위 10행에 없음)' })
      continue
    }
    const { rowNumber: headerRowNo, headers } = header
    const colIndex = (label: string): number => headers.findIndex((h) => h === label)
    const idxId = 0
    const idxTitle = colIndex('제목')
    const idxProc = colIndex('확인절차')
    const idxExp = colIndex('기대결과')
    const idxResult = colIndex('확인결과')

    if (idxResult < 0) {
      skippedSheets.push({ sheet: sheet.name, reason: `'확인결과' 컬럼 없음 (파일 헤더: ${headers.filter(Boolean).slice(0, 8).join(', ')}...)` })
      continue
    }

    const normSheetName = normalizeText(sheet.name)
    const folderExists = knownFolders.has(normSheetName)

    const lastRow = sheet.lastRow?.number ?? headerRowNo
    for (let r = headerRowNo + 1; r <= lastRow; r++) {
      const row = sheet.getRow(r)
      const cellValue = (idx: number) => (idx >= 0 ? normalize(row.getCell(idx + 1).value) : '')
      const idText = normalize(row.getCell(idxId + 1).value)
      if (!idText || idText.startsWith('▶')) continue
      if (!/\d/.test(idText)) continue

      let title = idxTitle >= 0 ? cellValue(idxTitle) : ''
      if (!title) {
        const proc = cellValue(idxProc)
        const exp = cellValue(idxExp)
        title = (proc || exp || idText).split('\n')[0].trim().slice(0, 200)
      }
      if (!title) continue

      const rawResult = cellValue(idxResult).toUpperCase()
      if (!rawResult) continue  // 확인결과 비어있으면 그냥 스킵 (기존 값 유지)
      if (!ALLOWED_RESULTS.has(rawResult)) {
        notFound.push({ sheet: sheet.name, title, result: rawResult, reason: `확인결과 값 "${rawResult}" 은 허용값(PASS/FAIL/N/A/N/T) 아님` })
        continue
      }

      const normTitle = normalizeText(title)

      // 1단계: (시트명, 제목) 정확 매칭
      let tcId = tcByDomainAndTitle.get(`${normSheetName}|${normTitle}`)
      let matchNote = ''

      if (!tcId) {
        // 2단계: 제목만으로 프로젝트 전체 검색
        const candidates = tcByTitle.get(normTitle) ?? []
        if (candidates.length === 1) {
          tcId = candidates[0]
          matchNote = ' (제목만 매칭)'
        } else if (candidates.length > 1) {
          notFound.push({
            sheet: sheet.name,
            title,
            result: rawResult,
            reason: `같은 제목 TC가 ${candidates.length}개 있어 모호함. 폴더명이 "${sheet.name}"과 일치하는지 확인`,
          })
          continue
        } else {
          // 아예 없음 - 원인 진단
          const reason = folderExists
            ? `폴더 "${sheet.name}" 안에 같은 제목의 TC 없음 (제목이 편집됐거나 다른 문자열)`
            : `xlsx 시트명 "${sheet.name}" 과 정확히 같은 폴더가 없음. 폴더 이름 확인 필요`
          notFound.push({ sheet: sheet.name, title, result: rawResult, reason })
          continue
        }
      }

      const { error: uErr } = await supabase
        .from('testcases')
        .update({ latest_result: rawResult })
        .eq('id', tcId)

      if (uErr) {
        errors.push(`[${sheet.name}] ${title.slice(0, 30)}${matchNote}: ${uErr.message}`)
      } else {
        updated++
        const domId = tcIdToDomain.get(tcId)
        if (domId) touchedDomainIds.add(domId)
      }
    }
  }

  // 업데이트 대상이던 폴더들 자동 승격 (모든 TC 완료 시)
  for (const domId of touchedDomainIds) {
    await autoPromoteFolderIfAllDone(supabase, domId)
  }

  revalidatePath('/testcases')
  revalidatePath('/')
  revalidatePath('/test-runs')

  return {
    updated,
    skippedSheets,
    notFound: notFound.slice(0, 50),
    errors: errors.slice(0, 30),
  }
}
