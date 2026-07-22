'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

function StyledSelect({
  value,
  onChange,
  children,
  title,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={title}
        className="appearance-none pl-3 pr-9 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer"
      >
        {children}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'created-desc', label: '생성일 최신순' },
  { value: 'created-asc', label: '생성일 오래된순' },
  { value: 'updated-desc', label: '수정일 최신순' },
  { value: 'updated-asc', label: '수정일 오래된순' },
  { value: 'title-asc', label: '제목 A→Z' },
  { value: 'title-desc', label: '제목 Z→A' },
  { value: 'tcno-asc', label: 'TC 번호 작은순' },
  { value: 'tcno-desc', label: 'TC 번호 큰순' },
]

export function FilterBar({ environments }: { environments: string[] }) {
  const router = useRouter()
  const params = useSearchParams()

  const [searchInput, setSearchInput] = useState(params.get('q') ?? '')

  // URL이 외부에서 바뀌면 입력창 동기화
  useEffect(() => {
    setSearchInput(params.get('q') ?? '')
  }, [params])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/testcases?${next.toString()}`)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    updateParam('q', searchInput)
  }

  function resetAll() {
    // 필터만 지우고 project 파라미터는 유지
    const next = new URLSearchParams()
    const project = params.get('project')
    if (project) next.set('project', project)
    setSearchInput('')
    router.push(`/testcases${next.toString() ? `?${next}` : ''}`)
  }

  const priority = params.get('priority') ?? ''
  const environment = params.get('environment') ?? ''
  const sort = params.get('sort') ?? 'tcno-asc'
  const hasAnyFilter = !!(searchInput || priority || environment || (sort && sort !== 'tcno-asc'))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <form onSubmit={submitSearch} className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="TC 제목 검색 (Enter)"
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        </form>

        <StyledSelect
          value={priority}
          onChange={(v) => updateParam('priority', v)}
        >
          <option value="">전체 우선순위</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </StyledSelect>

        <StyledSelect
          value={environment}
          onChange={(v) => updateParam('environment', v)}
        >
          <option value="">전체 환경</option>
          {environments.map((e) => <option key={e} value={e}>{e}</option>)}
        </StyledSelect>

        <StyledSelect
          value={sort}
          onChange={(v) => updateParam('sort', v === 'tcno-asc' ? '' : v)}
          title="정렬"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </StyledSelect>

        {hasAnyFilter && (
          <button
            onClick={resetAll}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            초기화
          </button>
        )}
      </div>
    </div>
  )
}
