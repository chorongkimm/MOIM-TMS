'use client'

import Link from 'next/link'
import React, { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { deleteTestcases, updateTestcaseExecutionStatus, updateTestcaseResult } from '../testcases/actions'
import { deleteDomainWithTestcases, moveDomain, updateDomainColor, updateDomainName } from '../_actions/projects'
import { BulkCreateModal } from './BulkCreateModal'
import { TcSidePanel } from './TcSidePanel'
import { formatDateTimeKR } from '@/lib/formatDate'

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
  execution_status: string | null
  author_name: string | null
  updated_at: string
  domain_id?: string | null
  domains?: { id: string; name: string; sort_order?: number; color?: string | null } | null
}

const EXECUTION_STATUSES: { key: string; bg: string; text: string; label: string }[] = [
  { key: '대기', bg: '#f3f4f6', text: '#374151', label: '대기' },
  { key: '진행중', bg: '#dbeafe', text: '#1d4ed8', label: '진행중' },
  { key: '완료', bg: '#dcfce7', text: '#15803d', label: '완료' },
  { key: '홀드', bg: '#fef9c3', text: '#a16207', label: '홀드' },
  { key: '재검토', bg: '#ffedd5', text: '#c2410c', label: '재검토' },
]

const EXECUTION_STATUS_MAP = new Map(EXECUTION_STATUSES.map((s) => [s.key, s]))

function ExecutionStatusDropdown({ tcId, current }: { tcId: string; current: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [localValue, setLocalValue] = useState<string | null>(current)
  const [isPending, startTransition] = useTransition()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalValue(current)
  }, [current])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function pick(value: string | null) {
    setOpen(false)
    const prev = localValue
    setLocalValue(value)
    startTransition(async () => {
      try {
        await updateTestcaseExecutionStatus(tcId, value)
        router.refresh()
      } catch (err) {
        setLocalValue(prev)
        alert((err as Error).message)
      }
    })
  }

  const currentStyle = localValue ? EXECUTION_STATUS_MAP.get(localValue) : null

  return (
    <div ref={wrapRef} className="relative inline-block">
      {currentStyle ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={isPending}
          className={`
            inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full
            hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-400
            ${isPending ? 'opacity-60' : ''}
          `}
          style={{ backgroundColor: currentStyle.bg, color: currentStyle.text }}
        >
          {currentStyle.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 border border-dashed border-gray-300 rounded-full hover:bg-gray-50 hover:text-gray-600"
        >
          + 상태
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[130px]">
          {EXECUTION_STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => pick(s.key)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                s.key === localValue ? 'bg-gray-50' : ''
              }`}
            >
              <span
                className="inline-flex items-center px-2 py-0.5 text-xs rounded-full"
                style={{ backgroundColor: s.bg, color: s.text }}
              >
                {s.label}
              </span>
              {s.key === localValue && <span className="ml-2 text-yellow-600">✓</span>}
            </button>
          ))}
          {localValue && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100 mt-1"
            >
              뱃지 제거
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const FOLDER_COLORS: { key: string; bg: string; text: string; label: string }[] = [
  { key: 'yellow', bg: '#fef9c3', text: '#a16207', label: 'TC 작성 완료' },
  { key: 'lime', bg: '#ecfccb', text: '#4d7c0f', label: 'TC 수행 중' },
  { key: 'sky', bg: '#e0f2fe', text: '#0369a1', label: 'TC 수행 완료' },
  { key: 'red', bg: '#fee2e2', text: '#b91c1c', label: '기타' },
]

const FOLDER_COLOR_MAP = new Map(FOLDER_COLORS.map((c) => [c.key, c]))

function FolderStatusBadge({
  domainId,
  currentColor,
}: {
  domainId: string
  currentColor: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    function onClick(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function pick(color: string | null) {
    setOpen(false)
    startTransition(async () => {
      try {
        await updateDomainColor(domainId, color)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  const current = FOLDER_COLOR_MAP.get(currentColor)
  if (!current) return null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: current.text }}
      >
        {current.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && (
        <div
          ref={menuRef}
          className="bg-white border border-gray-200 rounded-lg shadow-lg p-1 w-44"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 100 }}
        >
          <div className="space-y-0.5 mb-1">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => pick(c.key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-50 ${
                  c.key === currentColor ? 'bg-gray-50 font-semibold' : ''
                }`}
              >
                <span className="w-4 h-4 rounded border shrink-0" style={{ backgroundColor: c.bg, borderColor: c.text }} />
                <span className="flex-1 text-left text-gray-800">{c.label}</span>
                {c.key === currentColor && <span className="text-yellow-600">✓</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className="w-full text-left px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded border-t border-gray-100"
          >
            뱃지 제거
          </button>
        </div>
      )}
    </>
  )
}

function FolderNameEditor({ domainId, currentName }: { domainId: string; currentName: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentName)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(currentName) }, [currentName])
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function save() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === currentName) {
      setDraft(currentName)
      setEditing(false)
      return
    }
    startTransition(async () => {
      try {
        await updateDomainName(domainId, trimmed)
        setEditing(false)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
        setDraft(currentName)
        setEditing(false)
      }
    })
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save() }
          else if (e.key === 'Escape') { setDraft(currentName); setEditing(false) }
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={isPending}
        className="text-sm font-semibold text-gray-800 px-1.5 py-0.5 border border-yellow-400 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300 min-w-[120px]"
      />
    )
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      title="더블클릭해서 이름 변경"
      className="text-sm font-semibold text-gray-800 hover:bg-white/60 rounded px-1 -mx-1 cursor-text"
    >
      {currentName}
    </span>
  )
}

function FolderColorPicker({
  domainId,
  currentColor,
  showPlusButton = false,
}: {
  domainId: string
  currentColor: string | null | undefined
  showPlusButton?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    function onClick(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function pick(color: string | null) {
    setOpen(false)
    startTransition(async () => {
      try {
        await updateDomainColor(domainId, color)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  const currentStyle = currentColor ? FOLDER_COLOR_MAP.get(currentColor) : null

  return (
    <>
      {showPlusButton ? (
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 border border-dashed border-gray-300 rounded hover:bg-gray-50 hover:text-gray-600"
        >
          + 상태
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={isPending}
          title="폴더 색 변경"
          className="w-5 h-5 rounded flex items-center justify-center hover:ring-2 hover:ring-gray-300"
        >
          {currentStyle ? (
            <div
              className="w-3.5 h-3.5 rounded border"
              style={{ backgroundColor: currentStyle.bg, borderColor: currentStyle.text }}
            />
          ) : (
            <div className="w-3.5 h-3.5 rounded border border-gray-300 bg-white" />
          )}
        </button>
      )}
      {open && pos && (
        <div
          ref={menuRef}
          className="bg-white border border-gray-200 rounded-lg shadow-lg p-1 w-44"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 100 }}
        >
          <div className="space-y-0.5 mb-1">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => pick(c.key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-50 ${
                  c.key === currentColor ? 'bg-gray-50 font-semibold' : ''
                }`}
              >
                <span className="w-4 h-4 rounded border shrink-0" style={{ backgroundColor: c.bg, borderColor: c.text }} />
                <span className="flex-1 text-left text-gray-800">{c.label}</span>
                {c.key === currentColor && <span className="text-yellow-600">✓</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className="w-full text-left px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded border-t border-gray-100"
          >
            색상 제거
          </button>
        </div>
      )}
    </>
  )
}

const PRIORITY_STYLE: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-700',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
}

const RESULT_STYLE: Record<Result, string> = {
  PASS: 'bg-sky-200 text-black',
  FAIL: 'bg-red-200 text-black',
  'N/A': 'bg-yellow-200 text-black',
  'N/T': 'bg-gray-200 text-black',
}

const RESULT_ORDER: Result[] = ['PASS', 'FAIL', 'N/A', 'N/T']

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {text}
    </span>
  )
}

const formatDateTime = formatDateTimeKR

function ResultDropdown({
  tcId,
  currentResult,
}: {
  tcId: string
  currentResult: Result | null
}) {
  const router = useRouter()
  const [localResult, setLocalResult] = useState<Result | null>(currentResult)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLocalResult(currentResult)
  }, [currentResult])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = (e.target.value || null) as Result | null
    if (!next) return  // 빈 옵션 유지용, 실제 저장 안 함
    setLocalResult(next)  // 낙관적 업데이트
    startTransition(async () => {
      try {
        await updateTestcaseResult(tcId, next)
        router.refresh()
      } catch (err) {
        setLocalResult(currentResult)
        alert((err as Error).message)
      }
    })
  }

  const isEmpty = !localResult
  return (
    <div className="relative inline-block">
      <select
        value={localResult ?? ''}
        onChange={handleChange}
        disabled={isPending}
        className={`
          appearance-none pl-2.5 pr-7 py-0.5 text-xs font-semibold rounded-full
          border focus:outline-none focus:ring-2 focus:ring-yellow-400
          cursor-pointer transition-opacity
          ${isEmpty ? 'border-dashed border-gray-300 text-gray-400 bg-white' : `border-transparent ${RESULT_STYLE[localResult!]}`}
          ${isPending ? 'opacity-60' : ''}
        `}
      >
        {isEmpty && <option value="" disabled hidden>선택</option>}
        {RESULT_ORDER.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <svg
        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

export function TestcaseTable({
  testcases,
  projectId,
  projectPrefix: _projectPrefix,
  hasAnyFilter,
}: {
  testcases: TC[]
  projectId: string
  projectPrefix: string
  hasAnyFilter: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // 기본 접힘: expandedFolders 에 명시된 것만 열림
  // 사용자가 폴더를 펼치면 여기 추가됨 → 이후 TC 삭제/추가로 refresh 되어도 유지
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [bulkTarget, setBulkTarget] = useState<{ domainId: string | null; domainName: string } | null>(null)
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  // URL 의 ?tc=<id> 로 사이드 패널 열기
  const openTcId = searchParams.get('tc')
  function openTcPanel(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tc', id)
    router.replace(`/testcases?${params.toString()}`, { scroll: false })
  }
  function closeTcPanel() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tc')
    const qs = params.toString()
    router.replace(`/testcases${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  // 폴더별 그룹핑 (도메인 없음도 하나의 그룹) + sort_order 기준 정렬
  const groupMap = new Map<string, { key: string; name: string; color: string | null; sortOrder: number; items: TC[] }>()
  for (const tc of testcases) {
    const key = tc.domains?.id ?? '__none__'
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        name: tc.domains?.name ?? '(폴더 미지정)',
        color: tc.domains?.color ?? null,
        sortOrder: tc.domains?.sort_order ?? Number.POSITIVE_INFINITY,
        items: [],
      })
    }
    groupMap.get(key)!.items.push(tc)
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.key === '__none__') return 1
    if (b.key === '__none__') return -1
    return a.sortOrder - b.sortOrder
  })

  const allChecked = testcases.length > 0 && selected.size === testcases.length
  const someChecked = selected.size > 0 && selected.size < testcases.length

  function toggleFolder(key: string) {
    setExpandedFolders((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleMoveFolder(domainId: string, direction: 'up' | 'down') {
    if (domainId === '__none__') return
    startTransition(async () => {
      try {
        await moveDomain(domainId, direction)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function handleDeleteFolder(domainId: string, name: string, count: number) {
    if (domainId === '__none__') {
      alert('폴더 미지정 그룹은 삭제할 수 없습니다.')
      return
    }
    const msg = `"${name}" 폴더를 삭제하시겠어요?\n\n안에 있는 TC ${count}개도 함께 삭제됩니다.\n(되돌릴 수 없습니다)`
    if (!confirm(msg)) return
    startTransition(async () => {
      try {
        await deleteDomainWithTestcases(domainId)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`선택한 TC ${selected.size}개를 삭제하시겠어요?\n(되돌릴 수 없습니다)`)) return
    const ids = Array.from(selected)
    startTransition(async () => {
      try {
        const res = await deleteTestcases(ids)
        setSelected(new Set())
        router.refresh()
        if (res.count !== ids.length) {
          alert(`${res.count}개 삭제됨 (요청: ${ids.length}개)`)
        }
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someChecked
    }
  }, [someChecked])

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(testcases.map((t) => t.id)))
  }

  const exportUrl = selected.size > 0
    ? `/api/testcases/export?ids=${Array.from(selected).join(',')}`
    : '#'

  return (
    <>
      {selected.size > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="text-sm text-yellow-900">
            <strong className="font-semibold">{selected.size}개</strong>{' '}
            <span className="text-yellow-700">선택됨</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-sm text-yellow-800 hover:text-yellow-900 hover:bg-yellow-100 rounded font-medium"
            >
              선택 해제
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isPending}
              className="px-3.5 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium shadow-sm disabled:opacity-50"
            >
              {isPending ? '삭제 중...' : `삭제 (${selected.size})`}
            </button>
            <a
              href={exportUrl}
              className="px-3.5 py-1.5 text-sm bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 font-medium shadow-sm"
            >
              선택 항목 내보내기 (.xlsx)
            </a>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left w-10">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="rounded border-gray-300 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">제목</th>
                <th className="tc-col-hide-on-panel px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">우선순위</th>
                <th className="tc-col-hide-on-panel px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">환경</th>
                <th className="tc-col-hide-on-panel px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">확인결과</th>
                <th className="tc-col-hide-on-panel px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">작성자</th>
                <th className="tc-col-hide-on-panel px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">수정일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map((group, gIdx) => {
                const collapsed = !expandedFolders.has(group.key)
                const orderableGroups = groups.filter((g) => g.key !== '__none__')
                const orderIndex = orderableGroups.findIndex((g) => g.key === group.key)
                const isFirst = orderIndex === 0
                const isLast = orderIndex === orderableGroups.length - 1
                return (
                  <React.Fragment key={group.key}>
                    <tr
                      className="border-t-2 border-b border-gray-200 group"
                      style={{
                        backgroundColor: group.color
                          ? FOLDER_COLOR_MAP.get(group.color)?.bg ?? '#f3f4f6'
                          : '#f3f4f6',
                      }}
                    >
                      <td colSpan={7} className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleFolder(group.key)}
                              className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-black"
                            >
                              <svg
                                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                              <span>📁</span>
                            </button>
                            {group.key === '__none__' ? (
                              <span className="text-sm font-semibold text-gray-800">{group.name}</span>
                            ) : (
                              <FolderNameEditor domainId={group.key} currentName={group.name} />
                            )}
                            <span className="text-xs text-gray-500 font-normal">({group.items.length})</span>
                            {group.color && FOLDER_COLOR_MAP.get(group.color) ? (
                              <FolderStatusBadge
                                domainId={group.key}
                                currentColor={group.color}
                              />
                            ) : (
                              group.key !== '__none__' && (
                                <FolderColorPicker domainId={group.key} currentColor={null} showPlusButton />
                              )
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setBulkTarget({
                                domainId: group.key === '__none__' ? null : group.key,
                                domainName: group.name,
                              })}
                              disabled={isPending}
                              title="이 폴더에 TC 여러 개 만들기"
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-white/60 rounded font-medium"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              여러 개 만들기
                            </button>
                            {group.key !== '__none__' && (
                              <>
                                <div className="w-px h-4 bg-gray-300 mx-1" />
                                <button
                                  type="button"
                                  onClick={() => handleMoveFolder(group.key, 'up')}
                                  disabled={isPending || isFirst}
                                  title="위로 이동"
                                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="18 15 12 9 6 15" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveFolder(group.key, 'down')}
                                  disabled={isPending || isLast}
                                  title="아래로 이동"
                                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                                <div className="w-px h-4 bg-gray-300 mx-1" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFolder(group.key, group.name, group.items.length)}
                                  disabled={isPending}
                                  title="폴더 및 안의 TC 모두 삭제"
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  </svg>
                                  삭제
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {!collapsed && group.items.map((tc) => (
                      <tr
                        key={tc.id}
                        className={`transition-colors ${selected.has(tc.id) ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(tc.id)}
                            onChange={() => toggle(tc.id)}
                            className="rounded border-gray-300 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-gray-900">
                          <button
                            type="button"
                            onClick={() => openTcPanel(tc.id)}
                            className="text-left hover:underline hover:text-yellow-700 font-medium"
                          >
                            {tc.title}
                          </button>
                        </td>
                        <td className="tc-col-hide-on-panel px-4 py-2.5">
                          <Badge text={tc.priority} className={PRIORITY_STYLE[tc.priority] ?? 'bg-gray-100 text-gray-700'} />
                        </td>
                        <td className="tc-col-hide-on-panel px-4 py-2.5 text-gray-700">{tc.environment}</td>
                        <td className="tc-col-hide-on-panel px-4 py-2.5">
                          <ResultDropdown tcId={tc.id} currentResult={tc.latest_result as Result | null} />
                        </td>
                        <td className="tc-col-hide-on-panel px-4 py-2.5 text-gray-700">{tc.author_name || '김초롱'}</td>
                        <td className="tc-col-hide-on-panel px-4 py-2.5 text-gray-500 text-xs font-mono whitespace-nowrap">
                          {formatDateTime(tc.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
              {testcases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="text-gray-400 text-sm">
                      {hasAnyFilter ? (
                        <>필터 조건에 맞는 TC가 없어요.</>
                      ) : (
                        <>아직 TC가 없어요.<br />
                        <Link href="/testcases/new" className="text-yellow-600 hover:underline font-medium mt-2 inline-block">
                          첫 TC 만들기 →
                        </Link></>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
          {hasAnyFilter ? (
            <>필터 결과 <strong className="text-gray-900">{testcases.length}</strong>개</>
          ) : (
            <>총 <strong className="text-gray-900">{testcases.length}</strong>개</>
          )}
          {selected.size > 0 && (
            <span className="ml-3 text-yellow-700">
              (선택: {selected.size}개)
            </span>
          )}
        </div>
      </div>

      {bulkTarget && (
        <BulkCreateModal
          projectId={projectId}
          domainId={bulkTarget.domainId}
          domainName={bulkTarget.domainName}
          onClose={() => setBulkTarget(null)}
        />
      )}

      <TcSidePanel tcId={openTcId} onClose={closeTcPanel} />
    </>
  )
}
