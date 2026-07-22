'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createProject, deleteProject, moveProject, updateProjectName } from '../_actions/projects'

// "45차" vs "45.5차" 같이 소수점 있는 숫자도 자연스럽게 정렬
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

type Project = {
  id: string
  name: string
  tc_prefix: string
  totalTcs?: number
  passRate?: number
}

export function ProjectList({
  projects,
  currentProjectId,
}: {
  projects: Project[]
  currentProjectId: string | null
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // 정렬 (localStorage 저장)
  type SortMode = 'created' | 'name-asc' | 'name-desc'
  const [sortMode, setSortMode] = useState<SortMode>('created')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('mointms.projectSort') : null
    if (saved === 'name-asc' || saved === 'name-desc' || saved === 'created') {
      setSortMode(saved)
    }
  }, [])

  function setSort(mode: SortMode) {
    setSortMode(mode)
    if (typeof window !== 'undefined') localStorage.setItem('mointms.projectSort', mode)
  }

  const sortedProjects = [...projects]
  if (sortMode === 'name-asc') {
    sortedProjects.sort((a, b) => naturalCompare(a.name, b.name))
  } else if (sortMode === 'name-desc') {
    sortedProjects.sort((a, b) => naturalCompare(b.name, a.name))
  }
  // 'created' 는 서버가 주는 순서 그대로

  const sortLabel: Record<SortMode, string> = {
    'created': '생성순',
    'name-asc': '이름 A→Z',
    'name-desc': '이름 Z→A',
  }
  const [showSortMenu, setShowSortMenu] = useState(false)

  // 새 스프린트 추가 상태
  const [adding, setAdding] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPrefix, setAddPrefix] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const addNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding && addNameRef.current) {
      addNameRef.current.focus()
    }
  }, [adding])

  function startAdd() {
    setAdding(true)
    setAddName('')
    setAddPrefix('')
    setAddError(null)
  }

  function cancelAdd() {
    setAdding(false)
    setAddName('')
    setAddPrefix('')
    setAddError(null)
  }

  function saveAdd() {
    const name = addName.trim()
    if (!name) {
      setAddError('스프린트 이름을 입력하세요')
      return
    }
    startTransition(async () => {
      try {
        await createProject(name, addPrefix)
        cancelAdd()
        // 스프린트만 생성하고 현재 페이지에 그대로 머무름
        router.refresh()
      } catch (e) {
        setAddError((e as Error).message)
      }
    })
  }

  function handleAddKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveAdd() }
    else if (e.key === 'Escape') { e.preventDefault(); cancelAdd() }
  }

  function handleMove(e: React.MouseEvent, id: string, direction: 'up' | 'down') {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      try {
        await moveProject(id, direction)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function handleDelete(e: React.MouseEvent, p: Project) {
    e.preventDefault()
    e.stopPropagation()
    const total = typeof p.totalTcs === 'number' ? p.totalTcs : 0
    const msg = total > 0
      ? `"${p.name}" 스프린트를 삭제하시겠어요?\n\n안에 있는 TC ${total}개, 폴더 전부 함께 삭제됩니다.\n(되돌릴 수 없습니다)`
      : `"${p.name}" 스프린트를 삭제하시겠어요?`
    if (!confirm(msg)) return
    startTransition(async () => {
      try {
        await deleteProject(p.id)
        router.push('/')
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  function startEdit(p: Project) {
    setEditingId(p.id)
    setDraftName(p.name)
    setError(null)
  }

  function cancel() {
    setEditingId(null)
    setDraftName('')
    setError(null)
  }

  function save() {
    if (!editingId) return
    const original = projects.find((p) => p.id === editingId)
    if (!original) return cancel()
    if (draftName.trim() === original.name) return cancel()

    startTransition(async () => {
      try {
        await updateProjectName(editingId, draftName)
        setEditingId(null)
        setDraftName('')
        setError(null)
        router.refresh()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    else if (e.key === 'Escape') { e.preventDefault(); cancel() }
  }

  return (
    <div>
      {/* 정렬 컨트롤 */}
      {projects.length > 1 && (
        <div className="relative mb-2 px-2">
          <button
            type="button"
            onClick={() => setShowSortMenu((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 rounded"
          >
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M6 12h12M10 18h4" />
              </svg>
              {sortLabel[sortMode]}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showSortMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSortMenu(false)}
              />
              <div className="absolute left-2 right-2 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
                {(['created', 'name-asc', 'name-desc'] as SortMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setSort(m); setShowSortMenu(false) }}
                    className={`
                      w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50
                      ${m === sortMode ? 'text-yellow-700 bg-yellow-50 font-medium' : 'text-gray-700'}
                    `}
                  >
                    {sortLabel[m]}
                    {m === sortMode && <span className="ml-1">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <nav className="space-y-0.5">
        {projects.length === 0 && !adding && (
          <div className="px-2 py-2 text-sm text-gray-400">아직 스프린트가 없어요</div>
        )}
        {sortedProjects.map((p, idx) => {
        const isActive = p.id === currentProjectId
        const isEditing = p.id === editingId

        if (isEditing) {
          return (
            <div key={p.id} className="px-2 py-1.5 space-y-1">
              <input
                ref={inputRef}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={handleKey}
                onBlur={save}
                disabled={isPending}
                className="w-full px-2 py-1 text-sm border border-yellow-400 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300"
              />
              {error && (
                <div className="text-xs text-red-600 px-1">{error}</div>
              )}
              <div className="text-[10px] text-gray-400 px-1">
                Enter 저장 · Esc 취소
              </div>
            </div>
          )
        }

        const canMove = sortMode === 'created'
        const isFirst = idx === 0
        const isLast = idx === sortedProjects.length - 1
        return (
          <div key={p.id} className="group relative">
            <Link
              href={`/testcases?project=${p.tc_prefix}`}
              onDoubleClick={(e) => {
                e.preventDefault()
                startEdit(p)
              }}
              title="더블클릭으로 이름 수정"
              className={`
                flex items-center gap-2 px-2 py-2 rounded-md text-sm
                ${isActive
                  ? 'bg-yellow-50 text-yellow-900 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-yellow-500' : 'bg-gray-300'}`} />
              <span className="flex-1 truncate">{p.name}</span>
              {typeof p.totalTcs === 'number' && p.totalTcs > 0 ? (
                <span
                  className={`text-xs font-mono ${
                    (p.passRate ?? 0) >= 80 ? 'text-green-600' :
                    (p.passRate ?? 0) >= 50 ? 'text-yellow-600' :
                    'text-gray-400'
                  } group-hover:hidden`}
                  title={`전체 ${p.totalTcs}건 중 PASS 비율`}
                >
                  {p.passRate ?? 0}%
                </span>
              ) : (
                <span className="text-xs text-gray-300 group-hover:hidden" title="TC 없음">—</span>
              )}
            </Link>
            {/* hover 시 노출되는 액션 버튼들 */}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
              {canMove && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleMove(e, p.id, 'up')}
                    disabled={isPending || isFirst}
                    title="위로 이동"
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleMove(e, p.id, 'down')}
                    disabled={isPending || isLast}
                    title="아래로 이동"
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={(e) => handleDelete(e, p)}
                disabled={isPending}
                title="스프린트 삭제"
                className="flex items-center justify-center w-6 h-6 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
      </nav>

      {/* 새 스프린트 추가 */}
      <div className="mt-2 pt-2 border-t border-gray-100">
        {adding ? (
          <div className="px-2 py-1.5 space-y-1.5">
            <input
              ref={addNameRef}
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={handleAddKey}
              placeholder="스프린트 이름 (예: 48차)"
              disabled={isPending}
              className="w-full px-2 py-1 text-sm border border-yellow-400 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
            <input
              value={addPrefix}
              onChange={(e) => setAddPrefix(e.target.value.toUpperCase())}
              onKeyDown={handleAddKey}
              placeholder="코드 (선택, 예: S48)"
              maxLength={10}
              disabled={isPending}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded uppercase focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
            {addError && (
              <div className="text-xs text-red-600 px-1">{addError}</div>
            )}
            <div className="flex gap-1">
              <button
                onClick={saveAdd}
                disabled={isPending}
                className="flex-1 px-2 py-1 text-xs bg-yellow-400 text-black rounded font-medium hover:bg-yellow-500 disabled:opacity-50"
              >
                {isPending ? '저장 중...' : '추가'}
              </button>
              <button
                onClick={cancelAdd}
                disabled={isPending}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                취소
              </button>
            </div>
            <div className="text-[10px] text-gray-400 px-1">
              Enter 저장 · Esc 취소 · 코드 미입력 시 자동 생성
            </div>
          </div>
        ) : (
          <button
            onClick={startAdd}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>스프린트 추가</span>
          </button>
        )}
      </div>
    </div>
  )
}
