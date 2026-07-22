'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type SprintCard = {
  id: string
  name: string
  tc_prefix: string
  tcs_count: number
  done_count: number
}

// 소수점 있는 숫자도 자연스럽게 정렬 ("45차" < "45.5차")
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

type SortMode = 'created' | 'name-asc' | 'name-desc'

export function SprintSummaryList({ sprints }: { sprints: SprintCard[] }) {
  const [sortMode, setSortMode] = useState<SortMode>('created')

  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? localStorage.getItem('mointms.projectSort')
      : null
    if (saved === 'name-asc' || saved === 'name-desc' || saved === 'created') {
      setSortMode(saved)
    }
    // 스토리지 변경 감지 (다른 탭·컴포넌트에서 변경 시 반영)
    function onStorage(e: StorageEvent) {
      if (e.key === 'mointms.projectSort') {
        const v = e.newValue
        if (v === 'name-asc' || v === 'name-desc' || v === 'created') setSortMode(v)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const sorted = [...sprints]
  if (sortMode === 'name-asc') {
    sorted.sort((a, b) => naturalCompare(a.name, b.name))
  } else if (sortMode === 'name-desc') {
    sorted.sort((a, b) => naturalCompare(b.name, a.name))
  }
  // 'created' 는 서버에서 준 순서 그대로 (sort_order → created_at)

  if (sorted.length === 0) {
    return (
      <div className="col-span-full bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500 text-sm">
        스프린트가 없습니다.<br />
        <Link href="/testcases/new" className="text-yellow-600 hover:underline font-medium mt-2 inline-block">
          첫 TC로 스프린트 만들기 →
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {sorted.map((s) => {
        const rate = s.tcs_count > 0 ? Math.round((s.done_count / s.tcs_count) * 100) : 0
        return (
          <Link
            key={s.id}
            href={`/testcases?project=${s.tc_prefix}`}
            className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-yellow-400 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="font-semibold text-gray-900 text-sm">{s.name}</div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{s.tcs_count}</div>
                <div className="text-xs text-gray-500">TC</div>
              </div>
            </div>
            {s.tcs_count > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                완료율 <strong className="text-gray-900">{rate}%</strong>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
