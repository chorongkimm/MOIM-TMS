'use client'

import { useEffect, useRef, useState } from 'react'

function naturalCompare(a: string, b: string): number {
  const re = /(\d+(?:\.\d+)?)|(\D+)/g
  const partsA = a.match(re) ?? []
  const partsB = b.match(re) ?? []
  const len = Math.min(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const pA = partsA[i]
    const pB = partsB[i]
    const numA = /^\d/.test(pA) ? parseFloat(pA) : null
    const numB = /^\d/.test(pB) ? parseFloat(pB) : null
    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB
    } else {
      const cmp = pA.localeCompare(pB, 'ko')
      if (cmp !== 0) return cmp
    }
  }
  return partsA.length - partsB.length
}

export function ProjectPicker({
  projects,
  initialName = '',
}: {
  projects: { name: string; tc_prefix: string }[]
  initialName?: string
}) {
  const [value, setValue] = useState(initialName)
  const [creatingNew, setCreatingNew] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sorted = [...projects].sort((a, b) => naturalCompare(a.name, b.name))

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (creatingNew) {
    return (
      <>
        <input
          type="text"
          name="project_name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="새 스프린트 이름 (예: 48차)"
          required
          autoFocus
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => { setCreatingNew(false); setValue('') }}
          className="mt-2 text-xs text-gray-500 hover:text-gray-700"
        >
          ← 기존 스프린트에서 선택
        </button>
      </>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name="project_name" value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || '스프린트 선택'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1 max-h-72 overflow-y-auto">
          {sorted.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">기존 스프린트 없음</div>
          )}
          {sorted.map((p) => (
            <button
              key={p.tc_prefix}
              type="button"
              onClick={() => { setValue(p.name); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                p.name === value ? 'bg-yellow-50 text-yellow-900 font-medium' : 'text-gray-700'
              }`}
            >
              {p.name}
              {p.name === value && <span className="ml-2 text-yellow-600">✓</span>}
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              type="button"
              onClick={() => { setCreatingNew(true); setOpen(false); setValue('') }}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              새 스프린트 만들기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
