'use client'

import { useEffect, useState } from 'react'
import { getTestcaseFullDetail } from '../testcases/actions'
import { TestcaseDetail } from '../testcases/[id]/TestcaseDetail'

type Result = 'PASS' | 'FAIL' | 'N/T' | 'N/A'
type TC = {
  id: string
  tc_no: number
  title: string
  priority: string
  type: string
  environment: string
  status: string
  latest_result: Result | null
  precondition: string | null
  procedure: string | null
  expected: string | null
  notes: string | null
  jira_link: string | null
  author_name: string | null
  created_at: string
  updated_at: string
  domain_id?: string | null
  domains?: { id: string; name: string } | null
}
type Comment = { id: string; testcase_id: string; author_name: string | null; content: string; created_at: string }
type HistoryEntry = { id: string; testcase_id: string; editor_name: string | null; action: string; details: string | null; created_at: string }

const DEFAULT_WIDTH = 900
const MIN_WIDTH = 400
const STORAGE_KEY = 'mointms.tcPanelWidth'

export function TcSidePanel({
  tcId,
  onClose,
}: {
  tcId: string | null
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{
    tc: TC
    tcCode: string
    comments: Comment[]
    history: HistoryEntry[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isDragging, setIsDragging] = useState(false)

  // 초기 로드: localStorage 저장된 폭 복원
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) {
      const n = parseInt(saved)
      if (!isNaN(n) && n >= MIN_WIDTH) setWidth(n)
    }
  }, [])

  // 드래그 중일 때 mousemove/mouseup 리스너
  useEffect(() => {
    if (!isDragging) return
    function onMove(e: MouseEvent) {
      const newW = window.innerWidth - e.clientX
      const max = window.innerWidth * 0.9
      const clamped = Math.max(MIN_WIDTH, Math.min(max, newW))
      setWidth(clamped)
    }
    function onUp() {
      setIsDragging(false)
      // 저장
      localStorage.setItem(STORAGE_KEY, String(width))
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, width])

  useEffect(() => {
    if (!tcId) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    getTestcaseFullDetail(tcId)
      .then((res) => {
        if (!res) {
          setError('TC를 찾을 수 없어요')
          setData(null)
        } else {
          setData(res as { tc: TC; tcCode: string; comments: Comment[]; history: HistoryEntry[] })
        }
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [tcId])

  // ESC 키로 닫기
  useEffect(() => {
    if (!tcId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tcId, onClose])

  // 패널 열림 시 body에 클래스 추가 + 폭을 CSS 변수로 전달
  useEffect(() => {
    if (tcId) {
      document.body.classList.add('tc-panel-open')
      document.body.style.setProperty('--tc-panel-width', `${width}px`)
    } else {
      document.body.classList.remove('tc-panel-open')
      document.body.style.removeProperty('--tc-panel-width')
    }
    return () => {
      document.body.classList.remove('tc-panel-open')
      document.body.style.removeProperty('--tc-panel-width')
    }
  }, [tcId, width])

  if (!tcId) return null

  return (
    <>
      {/* 오른쪽 슬라이드 패널 (딤 없음, 드래그로 폭 조절) */}
      <div
        className="fixed inset-y-0 right-0 z-40 bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-slide-in"
        style={{ width: `${width}px`, maxWidth: '90vw' }}
      >
        {/* 왼쪽 드래그 핸들 */}
        <div
          onMouseDown={(e) => { e.preventDefault(); setIsDragging(true) }}
          className={`absolute inset-y-0 left-0 w-1.5 -translate-x-1/2 cursor-col-resize group ${isDragging ? 'bg-yellow-400/50' : 'hover:bg-yellow-400/40'}`}
          title="드래그해서 폭 조절"
        >
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 rounded-full transition-colors ${isDragging ? 'bg-yellow-500' : 'bg-gray-300 group-hover:bg-yellow-500'}`} />
        </div>
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-500">불러오는 중...</div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}
        {!loading && !error && data && (
          <TestcaseDetail
            tc={data.tc}
            tcCode={data.tcCode}
            comments={data.comments}
            history={data.history}
            variant="drawer"
            onClose={onClose}
          />
        )}
      </div>
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.2s ease-out; }
        body.tc-panel-open main {
          padding-right: var(--tc-panel-width, 900px);
        }
        body:not(.dragging) main {
          transition: padding-right 0.2s ease-out;
        }
        /* 패널 열림 시 TC 목록의 부가 컬럼 숨김 (제목만 표시) */
        body.tc-panel-open .tc-col-hide-on-panel {
          display: none;
        }
      `}</style>
    </>
  )
}
