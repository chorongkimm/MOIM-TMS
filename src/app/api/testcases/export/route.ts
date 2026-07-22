import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const idsParam = url.searchParams.get('ids') ?? ''
  const selectedIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
  const projectPrefix = url.searchParams.get('project') ?? ''

  const supabase = await createClient()

  let query = supabase
    .from('testcases')
    .select('*, projects!inner(name, tc_prefix)')

  if (selectedIds.length > 0) {
    query = query.in('id', selectedIds)
  } else if (projectPrefix) {
    query = query.eq('projects.tc_prefix', projectPrefix)
  }

  const { data: testcases, error } = await query.order('tc_no')

  if (error) {
    return new Response(`쿼리 실패: ${error.message}`, { status: 500 })
  }

  if (!testcases || testcases.length === 0) {
    return new Response('내보낼 TC가 없습니다', { status: 404 })
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'MOINTMS'
  wb.created = new Date()

  const sheet = wb.addWorksheet('TC', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'ID', key: 'id', width: 12 },
    { header: '제목', key: 'title', width: 50 },
    { header: '우선순위', key: 'priority', width: 12 },
    { header: '유형', key: 'type', width: 10 },
    { header: '환경', key: 'environment', width: 12 },
    { header: '사전조건', key: 'precondition', width: 40 },
    { header: '확인절차', key: 'procedure', width: 40 },
    { header: '기대결과', key: 'expected', width: 40 },
    { header: '작성자', key: 'author', width: 12 },
    { header: '비고', key: 'notes', width: 30 },
    { header: '프로젝트', key: 'projectName', width: 15 },
  ]

  // 헤더 스타일
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF434343' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 22

  for (const tc of testcases) {
    const tcCode = `NO_${String(tc.tc_no).padStart(3, '0')}`
    const proj = tc.projects as { name: string; tc_prefix: string } | null
    sheet.addRow({
      id: tcCode,
      title: tc.title,
      priority: tc.priority,
      type: tc.type,
      environment: tc.environment,
      precondition: tc.precondition ?? '',
      procedure: tc.procedure ?? '',
      expected: tc.expected ?? '',
      author: tc.author_name ?? '',
      notes: tc.notes ?? '',
      projectName: proj?.name ?? '',
    })
  }

  // 본문 스타일
  sheet.eachRow((row, i) => {
    if (i === 1) return
    row.alignment = { vertical: 'top', wrapText: true }
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      }
    })
  })

  const buffer = await wb.xlsx.writeBuffer()

  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const filename = `MOINTMS_TC_${ts}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
