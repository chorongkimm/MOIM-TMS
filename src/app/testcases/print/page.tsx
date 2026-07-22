import { createClient } from '@/lib/supabase/server'
import { formatDateTimeKR as formatDateTime } from '@/lib/formatDate'
import { PrintClient } from './PrintClient'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const RESULT_STYLE: Record<string, { bg: string; color: string }> = {
  PASS: { bg: '#bae6fd', color: '#000' },
  FAIL: { bg: '#fecaca', color: '#000' },
  'N/A': { bg: '#fef08a', color: '#000' },
  'N/T': { bg: '#e5e7eb', color: '#000' },
}

const ENV_STYLE: Record<string, { bg: string; color: string }> = {
  Staging: { bg: '#dbeafe', color: '#1e40af' },
  Dev: { bg: '#d1fae5', color: '#065f46' },
  Prod: { bg: '#ffedd5', color: '#9a3412' },
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  Low: { bg: '#f3f4f6', color: '#374151' },
  Medium: { bg: '#fef3c7', color: '#92400e' },
  High: { bg: '#ffedd5', color: '#9a3412' },
  Critical: { bg: '#fee2e2', color: '#991b1b' },
}

export default async function PrintPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const idsParam = typeof params.ids === 'string' ? params.ids : ''
  const ids = idsParam.split(',').filter(Boolean)
  const projectPrefix = typeof params.project === 'string' ? params.project : ''

  const supabase = await createClient()
  let query = supabase
    .from('testcases')
    .select('*, projects!inner(name, tc_prefix), domains(name)')

  if (ids.length > 0) {
    query = query.in('id', ids)
  } else if (projectPrefix) {
    query = query.eq('projects.tc_prefix', projectPrefix)
  }

  const { data: testcases } = await query.order('tc_no')

  return (
    <>
      <PrintClient />
      <style>{`
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #111; background: #fff; }
        .no-print { display: block; }
        @media print { .no-print { display: none; } }
        .print-container { max-width: 800px; margin: 0 auto; padding: 24px; }
        .header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
        .tc-block { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
        .tc-id { font-family: monospace; color: #6b7280; font-size: 11px; }
        .tc-title { font-size: 15px; font-weight: 700; margin: 4px 0 12px; }
        .meta-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 500; }
        .section-label { font-weight: 600; color: #111; margin-top: 10px; font-size: 12px; }
        .section-value { color: #6b7280; white-space: pre-wrap; font-size: 12px; line-height: 1.5; margin-top: 2px; }
        .footer { font-size: 10px; color: #9ca3af; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
      `}</style>
      <div className="print-container">
        <div className="no-print" style={{ marginBottom: 16, padding: 12, background: '#fef3c7', borderRadius: 6, fontSize: 13 }}>
          잠시 후 인쇄 대화상자가 열립니다. <strong>대상</strong>을 <strong>PDF로 저장</strong>으로 선택하면 PDF 파일로 다운로드됩니다.
        </div>
        <div className="header">
          <div style={{ fontSize: 11, color: '#6b7280' }}>MOIN TMS · Test Case Report</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            TC {testcases?.length ?? 0}건
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            생성일: {formatDateTime(new Date().toISOString())}
          </div>
        </div>
        {(testcases ?? []).map((tc) => {
          const proj = tc.projects as { name: string; tc_prefix: string } | null
          const dom = tc.domains as { name: string } | null
          const tcCode = `NO_${String(tc.tc_no).padStart(3, '0')}`
          const result = (tc.latest_result ?? 'N/T') as string
          const rStyle = RESULT_STYLE[result] ?? RESULT_STYLE['N/T']
          const eStyle = ENV_STYLE[tc.environment] ?? { bg: '#e5e7eb', color: '#374151' }
          const pStyle = PRIORITY_STYLE[tc.priority] ?? PRIORITY_STYLE['Low']
          return (
            <div key={tc.id} className="tc-block">
              <div>
                <div className="tc-id">
                  {tcCode}
                  {dom && <span> · 📁 {dom.name}</span>}
                  {proj && <span> · {proj.name}</span>}
                </div>
                <div className="tc-title">{tc.title}</div>
              </div>
              <div className="meta-row">
                <span className="badge" style={{ background: pStyle.bg, color: pStyle.color }}>
                  {tc.priority}
                </span>
                <span className="badge" style={{ background: eStyle.bg, color: eStyle.color }}>
                  {tc.environment}
                </span>
                <span className="badge" style={{ background: rStyle.bg, color: rStyle.color, fontWeight: 700 }}>
                  {result}
                </span>
              </div>
              {tc.precondition && (
                <>
                  <div className="section-label">사전 조건</div>
                  <div className="section-value">{tc.precondition}</div>
                </>
              )}
              {tc.procedure && (
                <>
                  <div className="section-label">재현 절차</div>
                  <div className="section-value">{tc.procedure}</div>
                </>
              )}
              {tc.expected && (
                <>
                  <div className="section-label">기대 결과</div>
                  <div className="section-value">{tc.expected}</div>
                </>
              )}
              {tc.notes && (
                <>
                  <div className="section-label">비고</div>
                  <div className="section-value">{tc.notes}</div>
                </>
              )}
              <div className="footer">
                작성: {tc.author_name ?? '김초롱'} / {formatDateTime(tc.created_at)}
                {' · '}
                수정: {tc.author_name ?? '김초롱'} / {formatDateTime(tc.updated_at)}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
