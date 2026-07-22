'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { createTestcase } from '../actions'
import { ProjectPicker } from './ProjectPicker'

export function NewTestcaseForm({
  projects,
  initialProjectName,
  backHref,
}: {
  projects: { name: string; tc_prefix: string }[]
  initialProjectName: string
  backHref: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const res = await createTestcase(fd)
        setToast({ type: 'success', message: '저장되었어요!' })
        // 1초 후 목록으로 이동
        setTimeout(() => {
          router.push(`/testcases?project=${res.projectPrefix}`)
        }, 1000)
      } catch (err) {
        setToast({ type: 'error', message: (err as Error).message })
      }
    })
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 space-y-6">
        {/* 프로젝트 섹션 */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">프로젝트</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              스프린트 <span className="text-red-500">*</span>
            </label>
            <ProjectPicker projects={projects} initialName={initialProjectName} />
          </div>
        </section>

        {/* TC 기본 정보 */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">기본 정보</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">우선순위</label>
                <select
                  name="priority"
                  defaultValue="Medium"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">타입</label>
                <select
                  name="type"
                  defaultValue="기능"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                >
                  <option>기능</option>
                  <option>예외</option>
                  <option>UI</option>
                  <option>회귀</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">환경</label>
                <input
                  name="environment"
                  defaultValue="Staging"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>
            </div>
            <input type="hidden" name="status" defaultValue="정상" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">작성자</label>
              <input
                name="author_name"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* TC 상세 */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">상세 내용</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">사전조건</label>
              <textarea
                name="precondition"
                rows={3}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">확인절차</label>
              <textarea
                name="procedure"
                rows={5}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">기대결과</label>
              <textarea
                name="expected"
                rows={5}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비고</label>
              <textarea
                name="notes"
                rows={2}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href={backHref}
            className="px-5 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className={`px-5 py-2.5 text-sm rounded-lg font-medium shadow-sm ${
              isPending
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-400 text-black hover:bg-yellow-500'
            }`}
          >
            {isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>

      {/* 토스트 알림 */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-xl border font-medium text-sm flex items-center gap-2 animate-toast-in ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes toast-in {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-toast-in { animation: toast-in 0.2s ease-out; }
      `}</style>
    </>
  )
}
