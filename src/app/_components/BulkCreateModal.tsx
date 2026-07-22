'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createManyTestcases, type BulkTcInput } from '../testcases/actions'

type Row = {
  title: string
  precondition: string
  procedure: string
  expected: string
}

const EMPTY_ROW: Row = { title: '', precondition: '', procedure: '', expected: '' }

export function BulkCreateModal({
  projectId,
  domainId,
  domainName,
  onClose,
}: {
  projectId: string
  domainId: string | null
  domainName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }])
  const [isPending, startTransition] = useTransition()
  const firstInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  function updateCell(idx: number, field: keyof Row, value: string) {
    setRows((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }])
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  // 마지막 필드(기대결과)에서 Enter → 새 행 추가하고 그 행 첫 칸으로 포커스
  function handleKeyDown(e: React.KeyboardEvent, rowIdx: number, field: keyof Row) {
    // Cmd/Ctrl+Enter → 전체 저장
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
      return
    }
    // 기대결과 필드에서 그냥 Enter (shift 없이) → 다음 행으로
    if (field === 'expected' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (rowIdx === rows.length - 1) {
        addRow()
        // 새 행의 title 로 포커스 (다음 렌더 후)
        setTimeout(() => {
          const el = document.getElementById(`bulk-title-${rowIdx + 1}`)
          el?.focus()
        }, 0)
      } else {
        const el = document.getElementById(`bulk-title-${rowIdx + 1}`)
        el?.focus()
      }
    }
  }

  function handleSave() {
    const items: BulkTcInput[] = rows
      .map((r) => ({
        title: r.title.trim(),
        precondition: r.precondition.trim() || undefined,
        procedure: r.procedure.trim() || undefined,
        expected: r.expected.trim() || undefined,
      }))
      .filter((r) => r.title)

    if (items.length === 0) {
      alert('제목이 있는 TC가 하나도 없어요')
      return
    }

    startTransition(async () => {
      try {
        const res = await createManyTestcases(projectId, domainId, items)
        if (res.errors.length > 0) {
          alert(`${res.created}개 생성됨, ${res.errors.length}개 실패:\n\n${res.errors.slice(0, 5).join('\n')}`)
        }
        router.refresh()
        onClose()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  const validCount = rows.filter((r) => r.title.trim()).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-[1100px] max-w-full max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">📁 {domainName} - TC 여러 개 만들기</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              한 줄 = 1 TC · 제목만 있어도 저장됨 · <kbd className="px-1 bg-gray-100 rounded text-xs">Enter</kbd> 다음 행 · <kbd className="px-1 bg-gray-100 rounded text-xs">⌘/Ctrl+Enter</kbd> 전체 저장
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-2 py-2 text-xs font-semibold text-gray-500 text-center">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">제목 *</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">사전조건</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">확인절차</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">기대결과</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-xs text-gray-400 text-center align-top pt-3">{idx + 1}</td>
                    <td className="px-2 py-1.5 align-top">
                      <textarea
                        id={`bulk-title-${idx}`}
                        ref={idx === 0 ? firstInputRef : undefined}
                        value={row.title}
                        onChange={(e) => updateCell(idx, 'title', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'title')}
                        rows={2}
                        placeholder="TC 제목"
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400 resize-y min-h-[2.4rem]"
                      />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <textarea
                        value={row.precondition}
                        onChange={(e) => updateCell(idx, 'precondition', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'precondition')}
                        rows={2}
                        placeholder="선택"
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400 resize-y min-h-[2.4rem] font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <textarea
                        value={row.procedure}
                        onChange={(e) => updateCell(idx, 'procedure', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'procedure')}
                        rows={2}
                        placeholder="선택"
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400 resize-y min-h-[2.4rem] font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <textarea
                        value={row.expected}
                        onChange={(e) => updateCell(idx, 'expected', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'expected')}
                        rows={2}
                        placeholder="선택 · Enter로 다음 행"
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400 resize-y min-h-[2.4rem] font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="이 행 삭제"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            빈 행 추가
          </button>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            제목이 채워진 <strong className="text-gray-900">{validCount}개</strong> TC 저장됩니다
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || validCount === 0}
              className={`px-5 py-2 text-sm rounded-lg font-medium shadow-sm ${
                isPending || validCount === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-yellow-400 text-black hover:bg-yellow-500'
              }`}
            >
              {isPending ? '저장 중...' : `${validCount}개 저장`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
