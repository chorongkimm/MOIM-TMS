'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const OPTIONS: { value: 'daily' | 'weekly' | 'monthly'; label: string }[] = [
  { value: 'daily', label: '일간' },
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
]

export function PeriodToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get('period') ?? 'weekly') as 'daily' | 'weekly' | 'monthly'

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'weekly') params.delete('period')
    else params.set('period', next)
    router.push(`/${params.toString() ? `?${params}` : ''}`)
  }

  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => change(o.value)}
          className={`
            px-4 py-1.5 text-sm font-medium rounded-md transition-colors
            ${current === o.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}
          `}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
