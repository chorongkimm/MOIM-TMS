'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProjectDates } from '../_actions/projects'
import { formatDateKR as formatDateShort } from '@/lib/formatDate'

export function SprintDatePicker({
  projectId,
  startDate,
  endDate,
}: {
  projectId: string
  startDate: string | null
  endDate: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState(startDate ?? '')
  const [end, setEnd] = useState(endDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setStart(startDate ?? '')
    setEnd(endDate ?? '')
  }, [startDate, endDate])

  useEffect(() => {
    if (!editing) return
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [editing])

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        await updateProjectDates(projectId, start || null, end || null)
        setEditing(false)
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function cancel() {
    setStart(startDate ?? '')
    setEnd(endDate ?? '')
    setError(null)
    setEditing(false)
  }

  const hasRange = !!(startDate || endDate)

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {hasRange ? (
          <span>
            {formatDateShort(startDate) || '?'} ~ {formatDateShort(endDate) || '?'}
          </span>
        ) : (
          <span className="text-gray-500">기간 설정</span>
        )}
      </button>
      {editing && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 p-4 w-72">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">시작일</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">종료일</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => { setStart(''); setEnd('') }}
                disabled={isPending}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                초기화
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 font-medium"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs bg-yellow-400 text-black rounded hover:bg-yellow-500 font-medium"
                >
                  {isPending ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
