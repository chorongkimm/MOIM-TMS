'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTimeKR as formatDateTime } from '@/lib/formatDate'
import {
  createTodo,
  deleteTodo,
  toggleTodoDone,
  updateTodoColor,
  updateTodoContent,
} from '../_actions/todos'

type Todo = {
  id: string
  content: string
  color: string
  is_done: boolean
  author_name: string | null
  created_at: string
  updated_at: string
}

// 스티커 색상 팔레트 (10가지 파스텔)
const STICKY_COLORS: { key: string; bg: string; hover: string; border: string; label: string }[] = [
  { key: 'yellow', bg: '#fef9c3', hover: '#fef08a', border: '#eab308', label: '연노랑' },
  { key: 'lime', bg: '#ecfccb', hover: '#d9f99d', border: '#84cc16', label: '연두' },
  { key: 'red', bg: '#fee2e2', hover: '#fecaca', border: '#ef4444', label: '연빨강' },
  { key: 'sky', bg: '#e0f2fe', hover: '#bae6fd', border: '#0ea5e9', label: '연하늘' },
  { key: 'pink', bg: '#fce7f3', hover: '#fbcfe8', border: '#ec4899', label: '연분홍' },
  { key: 'orange', bg: '#ffedd5', hover: '#fed7aa', border: '#f97316', label: '연주황' },
  { key: 'purple', bg: '#f3e8ff', hover: '#e9d5ff', border: '#a855f7', label: '연보라' },
  { key: 'teal', bg: '#ccfbf1', hover: '#99f6e4', border: '#14b8a6', label: '연청록' },
  { key: 'amber', bg: '#fef3c7', hover: '#fde68a', border: '#f59e0b', label: '연호박' },
  { key: 'gray', bg: '#f3f4f6', hover: '#e5e7eb', border: '#9ca3af', label: '연회색' },
]

const COLOR_MAP = new Map(STICKY_COLORS.map((c) => [c.key, c]))

// 스티커에 살짝 랜덤한 각도 부여 (id 기반 seed로 일관성 유지)
function rotationFromId(id: string): number {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return ((hash % 5) - 2) * 0.4  // -0.8 ~ +0.8도
}

export function TodoBoard({ todos }: { todos: Todo[] }) {
  const router = useRouter()
  const [newContent, setNewContent] = useState('')
  const [newColor, setNewColor] = useState('yellow')
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    if (!newContent.trim()) return
    startTransition(async () => {
      try {
        await createTodo(newContent, newColor)
        setNewContent('')
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function handleAddKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleAdd()
    }
  }

  // 완료 안 된 것 먼저, 그 안에서는 최신 순
  const sorted = [...todos].sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="p-6">
      {/* 새 스티커 만들기 */}
      <div className="mb-6 max-w-md">
        <div
          className="rounded-md p-4 shadow-md border-l-4"
          style={{
            backgroundColor: COLOR_MAP.get(newColor)?.bg,
            borderColor: COLOR_MAP.get(newColor)?.border,
          }}
        >
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={handleAddKey}
            placeholder="할 일을 입력하세요"
            rows={2}
            disabled={isPending}
            className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-gray-500"
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10">
            <div className="flex items-center gap-1.5">
              {STICKY_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setNewColor(c.key)}
                  title={c.label}
                  className={`w-5 h-5 rounded-full border-2 ${newColor === c.key ? 'ring-2 ring-gray-500' : ''}`}
                  style={{ backgroundColor: c.bg, borderColor: c.border }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !newContent.trim()}
              className="px-3 py-1 text-xs bg-gray-900 text-white rounded font-medium disabled:opacity-40"
            >
              {isPending ? '추가 중...' : '추가'}
            </button>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Cmd+Enter 로 저장</div>
        </div>
      </div>

      {/* 스티커 목록 */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          아직 할 일이 없어요. 위에서 새 스티커를 추가해 보세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sorted.map((t) => (
            <StickyNote key={t.id} todo={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function StickyNote({ todo }: { todo: Todo }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.content)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [isPending, startTransition] = useTransition()

  const color = COLOR_MAP.get(todo.color) ?? COLOR_MAP.get('yellow')!
  const rotation = rotationFromId(todo.id)

  function saveContent() {
    if (draft.trim() === todo.content.trim()) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      try {
        await updateTodoContent(todo.id, draft)
        setEditing(false)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function changeColor(next: string) {
    setShowColorMenu(false)
    if (next === todo.color) return
    startTransition(async () => {
      try {
        await updateTodoColor(todo.id, next)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function toggleDone() {
    startTransition(async () => {
      try {
        await toggleTodoDone(todo.id, !todo.is_done)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function handleDelete() {
    if (!confirm('이 할 일을 삭제하시겠어요?')) return
    startTransition(async () => {
      try {
        await deleteTodo(todo.id)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  return (
    <div
      className={`
        relative rounded-md p-4 shadow-md border-l-4 min-h-[160px] flex flex-col
        transition-transform hover:scale-[1.02] hover:shadow-lg group
        ${todo.is_done ? 'opacity-60' : ''}
      `}
      style={{
        backgroundColor: color.bg,
        borderColor: color.border,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {/* 상단: 완료 체크박스 + 삭제 버튼 */}
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={todo.is_done}
            onChange={toggleDone}
            disabled={isPending}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">
            {todo.is_done ? '완료' : ''}
          </span>
        </label>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorMenu((v) => !v)}
              title="색상 변경"
              className="w-5 h-5 rounded-full border-2"
              style={{ backgroundColor: color.bg, borderColor: color.border }}
            />
            {showColorMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColorMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 p-1.5 flex gap-1">
                  {STICKY_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => changeColor(c.key)}
                      title={c.label}
                      className={`w-5 h-5 rounded-full border-2 ${c.key === todo.color ? 'ring-2 ring-gray-500' : ''}`}
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            title="삭제"
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-100 rounded"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* 내용 */}
      <div className="flex-1">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveContent}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(todo.content); setEditing(false) }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { saveContent() }
            }}
            autoFocus
            rows={4}
            className="w-full bg-transparent text-sm resize-none focus:outline-none"
          />
        ) : (
          <div
            onClick={() => { setDraft(todo.content); setEditing(true) }}
            className={`text-sm cursor-text whitespace-pre-wrap leading-relaxed ${todo.is_done ? 'line-through text-gray-500' : 'text-gray-800'}`}
          >
            {todo.content || <span className="text-gray-400">클릭해서 입력</span>}
          </div>
        )}
      </div>

      {/* 하단: 작성일 */}
      <div className="mt-2 pt-2 border-t border-black/10 text-[10px] text-gray-500 flex items-center justify-between">
        <span>{todo.author_name ?? '김초롱'}</span>
        <span className="font-mono">{formatDateTime(todo.created_at)}</span>
      </div>
    </div>
  )
}
