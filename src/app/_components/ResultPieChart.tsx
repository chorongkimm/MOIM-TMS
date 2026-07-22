'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

type ResultCount = {
  key: 'PASS' | 'FAIL' | 'N/T' | 'N/A' | 'Untested'
  label: string
  count: number
  color: string
}

export function ResultPieChart({ counts, total }: { counts: ResultCount[]; total: number }) {
  const data = counts
    .filter((c) => c.count > 0)
    .map((c) => ({ name: c.label, value: c.count, color: c.color }))

  const passCount = counts.find((c) => c.key === 'PASS')?.count ?? 0
  const untestedCount = counts.find((c) => c.key === 'N/T')?.count ?? 0
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-72 text-gray-400 text-sm">
        아직 TC가 없어요
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      {/* 파이 차트 */}
      <div className="w-64 h-64 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={0}
              outerRadius={100}
              paddingAngle={0}
              strokeWidth={2}
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.color}
                  stroke={d.color.toLowerCase() === '#ffffff' ? '#d1d5db' : '#fff'}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => {
                const n = typeof value === 'number' ? value : Number(value ?? 0)
                return [`${n}건 (${total > 0 ? Math.round((n / total) * 100) : 0}%)`, '']
              }}
              contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 */}
      <div className="flex-1 space-y-4">
        {counts.map((c) => {
          const pct = total > 0 ? Math.round((c.count / total) * 100) : 0
          return (
            <div key={c.key} className="flex items-center gap-3">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-gray-200"
                style={{ backgroundColor: c.color }}
              />
              <div>
                <div className="font-semibold text-gray-900">
                  {c.count} {c.label}
                </div>
                <div className="text-xs text-gray-500">
                  {pct}% set to {c.label}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ResultSummaryText({ counts, total }: { counts: ResultCount[]; total: number }) {
  const passCount = counts.find((c) => c.key === 'PASS')?.count ?? 0
  const untestedCount = (counts.find((c) => c.key === 'N/T')?.count ?? 0)
    + (counts.find((c) => c.key === 'Untested')?.count ?? 0)
  const passRate = total > 0 ? Math.round((passCount / total) * 10000) / 100 : 0
  const untestedRate = total > 0 ? Math.round((untestedCount / total) * 10000) / 100 : 0

  return (
    <div className="text-center mt-6 pt-6 border-t border-gray-100">
      <div className="text-2xl font-bold text-gray-900">
        {passRate.toFixed(2)}% Passed
      </div>
      {untestedCount > 0 && (
        <div className="text-sm text-gray-500 mt-1">
          아직 수행 안 됨: {untestedCount} / {total}건
        </div>
      )}
    </div>
  )
}
