'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { importTestcasesXlsx } from '../actions'

// 숫자 자연 정렬 ("45차" < "45.5차" < "46차")
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

function SprintSelect({
  projects,
  value,
  onChange,
}: {
  projects: { name: string; tc_prefix: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const sorted = [...projects].sort((a, b) => naturalCompare(a.name, b.name))

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

  if (creatingNew) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="새 스프린트 이름"
          autoFocus
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => { setCreatingNew(false); onChange('') }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          ← 기존 스프린트에서 선택
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50"
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
              onClick={() => { onChange(p.name); setOpen(false) }}
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
              onClick={() => { setCreatingNew(true); setOpen(false); onChange('') }}
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

export function ImportForm({
  projects,
  initialProjectName,
  backHref = '/testcases',
}: {
  projects: { name: string; tc_prefix: string }[]
  initialProjectName?: string
  backHref?: string
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [projectName, setProjectName] = useState(initialProjectName || projects[0]?.name || '')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: number; fail: number; folders: { name: string; count: number }[]; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('XLSX 파일을 선택해 주세요')
      return
    }
    if (!projectName.trim()) {
      setError('프로젝트를 선택하거나 입력해 주세요')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('target_project_name', projectName.trim())
      const res = await importTestcasesXlsx(fd)
      setResult(res)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">가져오기 결과</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-xs text-green-700 uppercase font-semibold">성공</div>
              <div className="text-3xl font-bold text-green-900 mt-1">{result.ok}건</div>
            </div>
            <div className={`${result.fail > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
              <div className={`text-xs ${result.fail > 0 ? 'text-red-700' : 'text-gray-600'} uppercase font-semibold`}>실패</div>
              <div className={`text-3xl font-bold mt-1 ${result.fail > 0 ? 'text-red-900' : 'text-gray-900'}`}>{result.fail}건</div>
            </div>
          </div>
          {result.folders.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                생성된 기능(폴더) {result.folders.length}개
              </h3>
              <ul className="text-xs space-y-1 max-h-60 overflow-y-auto">
                {result.folders.map((f, i) => (
                  <li key={i} className="flex justify-between px-3 py-1.5 bg-gray-50 rounded">
                    <span className="text-gray-700">📁 {f.name}</span>
                    <span className="text-gray-500 font-medium">{f.count} TC</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                경고·실패 (최대 30건)
              </h3>
              <ul className="text-xs space-y-1 text-red-700 bg-red-50 p-3 rounded max-h-60 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>· {e}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => { setResult(null); setFile(null); }}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              다시 가져오기
            </button>
            <button
              onClick={() => {
                const prefix = projects.find((p) => p.name === projectName)?.tc_prefix
                router.push(prefix ? `/testcases?project=${prefix}` : backHref)
              }}
              className="px-4 py-2 text-sm bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 font-medium"
            >
              목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 space-y-6">
      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          저장할 스프린트
        </h2>
        <SprintSelect
          projects={projects}
          value={projectName}
          onChange={setProjectName}
        />
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          XLSX 파일
        </h2>
        <label
          htmlFor="xlsx-file"
          className={`
            flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer
            ${file ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-yellow-400 hover:bg-yellow-50'}
          `}
        >
          <input
            id="xlsx-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 mb-2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <polyline points="9 15 11 17 15 13" />
              </svg>
              <div className="text-sm font-medium text-gray-900">{file.name}</div>
              <div className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              <div className="text-xs text-yellow-700 mt-2 underline">다른 파일 선택</div>
            </>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 mb-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div className="text-sm text-gray-600">XLSX 파일 클릭해서 선택</div>
              <div className="text-xs text-gray-400 mt-1">(내보내기로 받은 xlsx 그대로 넣거나, 같은 헤더로 만든 파일)</div>
            </>
          )}
        </label>

        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <div><strong className="text-gray-700">📁 여러 시트 자동 인식:</strong> 각 시트가 하나의 기능(폴더)로 자동 생성됨. TC들은 그 안에 저장.</div>
          <div><strong className="text-gray-700">건너뛰는 시트:</strong> 개요 / Overview / 요약</div>
          <div><strong className="text-gray-700">인식하는 컬럼(헤더 이름 기준):</strong> 제목, 우선순위, 유형, 환경, 상태, 사전조건, 확인절차, 기대결과, 확인결과, 작성자, 비고</div>
          <div><strong className="text-gray-700">확인결과 값:</strong> PASS / FAIL / N/A / N/T (없거나 다른 값이면 N/T)</div>
          <div><strong className="text-gray-700">제목이 없으면?</strong> 확인절차 첫 줄 → 기대결과 첫 줄 → ID 순으로 자동 사용</div>
          <div><strong className="text-gray-700">섹션 헤더(▶ ~) 행:</strong> 자동으로 건너뜀</div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          ⚠ {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Link
          href={backHref}
          className="px-5 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={submitting || !file}
          className={`px-5 py-2.5 text-sm rounded-lg font-medium shadow-sm ${
            submitting || !file
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-yellow-400 text-black hover:bg-yellow-500'
          }`}
        >
          {submitting ? '가져오는 중...' : '가져오기'}
        </button>
      </div>
    </form>
  )
}
