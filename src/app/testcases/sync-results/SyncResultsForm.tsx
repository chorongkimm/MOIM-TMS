'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { syncResultsFromXlsx } from '../actions'

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
            <div className="px-3 py-2 text-sm text-gray-400">스프린트 없음</div>
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
        </div>
      )}
    </div>
  )
}

type SyncResult = {
  updated: number
  skippedSheets: { sheet: string; reason: string }[]
  notFound: { sheet: string; title: string; result: string; reason: string }[]
  errors: string[]
}

export function SyncResultsForm({
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
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('XLSX 파일을 선택해 주세요')
      return
    }
    if (!projectName.trim()) {
      setError('대상 스프린트를 선택해 주세요')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('target_project_name', projectName.trim())
      const res = await syncResultsFromXlsx(fd)
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
          <h2 className="text-lg font-bold text-gray-900 mb-4">동기화 결과</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-xs text-green-700 uppercase font-semibold">업데이트됨</div>
              <div className="text-3xl font-bold text-green-900 mt-1">{result.updated}건</div>
            </div>
            <div className={`${result.notFound.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
              <div className={`text-xs ${result.notFound.length > 0 ? 'text-yellow-700' : 'text-gray-600'} uppercase font-semibold`}>못 찾음</div>
              <div className={`text-3xl font-bold mt-1 ${result.notFound.length > 0 ? 'text-yellow-900' : 'text-gray-900'}`}>{result.notFound.length}건</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-600 uppercase font-semibold">건너뛴 시트</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">{result.skippedSheets.length}개</div>
            </div>
          </div>

          {result.skippedSheets.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                건너뛴 시트 ({result.skippedSheets.length}개) - 사유
              </h3>
              <ul className="text-xs space-y-1.5 max-h-72 overflow-y-auto">
                {result.skippedSheets.map((s, i) => (
                  <li key={i} className="px-3 py-2 bg-gray-50 rounded border-l-2 border-gray-300">
                    <div className="font-semibold text-gray-800">📄 {s.sheet}</div>
                    <div className="text-gray-600 mt-0.5">→ {s.reason}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.notFound.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                못 찾은 TC ({result.notFound.length}건) - 사유
              </h3>
              <ul className="text-xs space-y-1.5 max-h-96 overflow-y-auto">
                {result.notFound.map((nf, i) => (
                  <li key={i} className="px-3 py-2 bg-yellow-50 rounded border-l-2 border-yellow-400">
                    <div className="flex gap-2 items-baseline">
                      <span className="text-gray-500 shrink-0">📁 {nf.sheet}</span>
                      <span className="text-gray-800 font-medium truncate">{nf.title}</span>
                      <span className="text-yellow-700 font-semibold shrink-0 ml-auto">→ {nf.result}</span>
                    </div>
                    <div className="text-gray-600 mt-1">⚠ {nf.reason}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">DB 에러</h3>
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
              다시 동기화
            </button>
            <button
              onClick={() => {
                const prefix = projects.find((p) => p.name === projectName)?.tc_prefix
                router.push(prefix ? `/testcases?project=${prefix}` : '/testcases')
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <div className="font-semibold mb-1">📌 확인결과 동기화란?</div>
        <div className="text-blue-800 leading-relaxed">
          이미 등록된 TC에 대해 <strong>확인결과(PASS/FAIL/N/A/N/T)만</strong> xlsx에서 읽어 업데이트합니다.
          <br />TC를 새로 만들거나 폴더를 추가하지 않습니다. 매칭 기준은 <strong>(시트명, 제목)</strong> 조합입니다.
        </div>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          대상 스프린트
        </h2>
        <SprintSelect projects={projects} value={projectName} onChange={setProjectName} />
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          XLSX 파일
        </h2>
        <label
          htmlFor="xlsx-file"
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer ${
            file ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-yellow-400 hover:bg-yellow-50'
          }`}
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
              <div className="text-sm text-gray-600">확인결과가 채워진 xlsx 파일 선택</div>
              <div className="text-xs text-gray-400 mt-1">(원본 업로드한 파일 그대로 사용 가능)</div>
            </>
          )}
        </label>

        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <div><strong className="text-gray-700">필수 컬럼:</strong> 제목 (또는 확인절차·기대결과), 확인결과</div>
          <div><strong className="text-gray-700">확인결과 값:</strong> PASS / FAIL / N/A / N/T (다른 값은 무시)</div>
          <div><strong className="text-gray-700">매칭:</strong> 시트명 = 폴더명, 제목 = TC 제목 (완전 일치)</div>
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
          {submitting ? '동기화 중...' : '동기화 시작'}
        </button>
      </div>
    </form>
  )
}
