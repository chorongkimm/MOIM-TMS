'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { formatDateTimeKR as formatDateTime } from '@/lib/formatDate'
import {
  createComment,
  deleteComment,
  deleteTestcase,
  duplicateTestcase,
  updateTestcase,
  updateTestcaseEnvironment,
  updateTestcaseField,
  updateTestcaseJiraLink,
  updateTestcasePriority,
  updateTestcaseResult,
  updateTestcaseType,
} from '../actions'

type Result = 'PASS' | 'FAIL' | 'N/T' | 'N/A'

const RESULT_STYLE: Record<Result, string> = {
  PASS: 'bg-sky-200 text-black',
  FAIL: 'bg-red-200 text-black',
  'N/A': 'bg-yellow-200 text-black',
  'N/T': 'bg-gray-200 text-black',
}

const PRIORITY_STYLE: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-700',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
}

const STATUS_STYLE: Record<string, string> = {
  정상: 'bg-blue-100 text-blue-800',
  완료: 'bg-green-100 text-green-800',
  보류: 'bg-gray-100 text-gray-700',
  폐기: 'bg-red-100 text-red-800',
}

function InlineEditableText({
  tcId,
  field,
  value,
  multiline = false,
  placeholder = '(비어있음)',
  className = '',
  titleClass = false,
}: {
  tcId: string
  field: 'title' | 'precondition' | 'procedure' | 'expected' | 'notes'
  value: string | null
  multiline?: boolean
  placeholder?: string
  className?: string
  titleClass?: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      // 커서 끝으로
      const len = inputRef.current.value.length
      inputRef.current.setSelectionRange(len, len)
    }
  }, [editing])

  function save() {
    const original = value ?? ''
    if (draft === original) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      try {
        await updateTestcaseField(tcId, field, draft)
        setEditing(false)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
        setDraft(original)
        setEditing(false)
      }
    })
  }

  function cancel() {
    setDraft(value ?? '')
    setEditing(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (multiline && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      save()
    }
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={(el) => { inputRef.current = el }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKey}
          disabled={isPending}
          rows={Math.max(3, (draft.match(/\n/g)?.length ?? 0) + 2)}
          className={`
            w-full px-2 py-1.5 text-sm border border-yellow-400 rounded-md
            focus:outline-none focus:ring-2 focus:ring-yellow-300 font-mono leading-relaxed
            ${className}
          `}
        />
      )
    }
    return (
      <input
        ref={(el) => { inputRef.current = el }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKey}
        disabled={isPending}
        className={`
          w-full px-2 py-1 border border-yellow-400 rounded-md
          focus:outline-none focus:ring-2 focus:ring-yellow-300
          ${titleClass ? 'text-2xl font-bold' : 'text-sm'}
          ${className}
        `}
      />
    )
  }

  const displayText = value?.trim() ?? ''
  // placeholder 는 이제 사용하지 않음 (원본 유지, 참조 방지 위해 언더스코어)
  void placeholder

  return (
    <div
      onClick={() => setEditing(true)}
      className={`
        cursor-text rounded-md px-2 -mx-2 py-0.5
        hover:bg-yellow-50 hover:outline hover:outline-1 hover:outline-yellow-200
        ${className}
      `}
    >
      {displayText ? (
        multiline ? (
          <div className="whitespace-pre-wrap text-gray-500 leading-relaxed">{displayText}</div>
        ) : (
          <span className={titleClass ? 'text-2xl font-bold text-gray-900' : ''}>{displayText}</span>
        )
      ) : (
        // 비어있으면 아무 문구도 표시 안 함. 클릭 가능한 최소 높이만 유지.
        <div className={multiline ? 'min-h-[1.5rem]' : 'min-h-[1.25rem]'} />
      )}
    </div>
  )
}

type TC = {
  id: string
  tc_no: number
  title: string
  priority: string
  type: string
  environment: string
  status: string
  latest_result: Result | null
  precondition: string | null
  procedure: string | null
  expected: string | null
  notes: string | null
  jira_link: string | null
  author_name: string | null
  created_at: string
  updated_at: string
  domain_id?: string | null
  domains?: { id: string; name: string } | null
}

const TC_TYPES: string[] = ['기능', '예외', 'UI', '회귀']
const TC_TYPE_STYLE: Record<string, string> = {
  '기능': 'bg-indigo-100 text-indigo-800',
  '예외': 'bg-rose-100 text-rose-800',
  'UI': 'bg-purple-100 text-purple-800',
  '회귀': 'bg-amber-100 text-amber-800',
}

type Comment = {
  id: string
  testcase_id: string
  author_name: string | null
  content: string
  created_at: string
}

type HistoryEntry = {
  id: string
  testcase_id: string
  editor_name: string | null
  action: string
  details: string | null
  created_at: string
}

export function TestcaseDetail({
  tc,
  tcCode,
  comments,
  history,
  backHref = '/testcases',
  variant = 'page',
  onClose,
}: {
  tc: TC
  tcCode: string
  comments: Comment[]
  history: HistoryEntry[]
  backHref?: string
  variant?: 'page' | 'drawer'
  onClose?: () => void
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'detail' | 'history'>('detail')
  const [editing, setEditing] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const res = await duplicateTestcase(tc.id)
        router.push(`/testcases/${res.newId}`)
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function handleDelete() {
    if (!confirm(`"${tc.title}" TC를 삭제하시겠어요?\n(되돌릴 수 없습니다)`)) return
    startTransition(async () => {
      try {
        await deleteTestcase(tc.id)
        alert('삭제되었습니다.')
        router.push(backHref)
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  function handleResultChange(r: Result) {
    setStatusMenuOpen(false)
    startTransition(async () => {
      try {
        await updateTestcaseResult(tc.id, r)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  async function handleSubmitEdit(fd: FormData) {
    try {
      await updateTestcase(tc.id, fd)
      alert('수정되었습니다.')
      setEditing(false)
      router.refresh()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const isDrawer = variant === 'drawer'
  const outerCls = isDrawer
    ? 'h-full bg-white overflow-y-auto'
    : 'min-h-screen bg-gray-50'
  const innerCls = isDrawer
    ? ''
    : 'max-w-4xl mx-auto bg-white min-h-screen shadow-sm'

  return (
    <div className={outerCls}>
      <div className={innerCls}>
        {/* 상단: TC ID + 제목 + 닫기/전체페이지 */}
        <div className="px-8 pt-8 pb-4 relative">
          <div className="absolute right-6 top-6 flex items-center gap-1">
            {isDrawer && (
              <Link
                href={`/testcases/${tc.id}`}
                className="p-1 text-gray-400 hover:text-gray-700"
                aria-label="전체 페이지로 열기"
                title="전체 페이지로 열기"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" />
                </svg>
              </Link>
            )}
            {isDrawer ? (
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-700"
                aria-label="닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <Link
                href={backHref}
                className="p-1 text-gray-400 hover:text-gray-700"
                aria-label="닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Link>
            )}
          </div>
          <div className="text-xs text-gray-500 font-mono mb-1">{tcCode}</div>
          <div className="pr-16">
            <InlineEditableText
              tcId={tc.id}
              field="title"
              value={tc.title}
              titleClass
              placeholder="(제목 없음)"
            />
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="px-8 pb-6 flex items-center gap-2">
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isPending}
            title="복제"
            className="flex items-center justify-center w-9 h-9 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            삭제
          </button>
        </div>

        {/* 탭 */}
        <div className="px-8 border-b border-gray-200">
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => setTab('detail')}
              className={`pb-3 text-sm font-medium border-b-2 ${
                tab === 'detail' ? 'text-gray-900 border-gray-900' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              상세 정보
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`pb-3 text-sm font-medium border-b-2 ${
                tab === 'history' ? 'text-gray-900 border-gray-900' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              수정 이력
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-8 py-6">
          {tab === 'detail' ? (
            editing ? (
              <EditForm
                tc={tc}
                onCancel={() => setEditing(false)}
                onSubmit={handleSubmitEdit}
              />
            ) : (
              <DetailView tc={tc} comments={comments} />
            )
          ) : (
            <HistoryView history={history} />
          )}
        </div>
      </div>
    </div>
  )
}

const PRIORITIES: string[] = ['Low', 'Medium', 'High', 'Critical']
const ENVIRONMENTS: string[] = ['Staging', 'Dev', 'Prod']

const ENV_STYLE: Record<string, string> = {
  Staging: 'bg-blue-100 text-blue-800',
  Dev: 'bg-green-100 text-green-800',
  Prod: 'bg-orange-100 text-orange-800',
}
const RESULTS: Result[] = ['PASS', 'FAIL', 'N/A', 'N/T']

function ResultDropdown({ tc }: { tc: TC }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [localResult, setLocalResult] = useState<Result | null>(tc.latest_result as Result | null)
  const [isPending, startTransition] = useTransition()
  const [askJira, setAskJira] = useState(false)         // FAIL 시 "지라 등록?" 팝업
  const [showContent, setShowContent] = useState(false) // "예" 누른 후 내용 복사 모달

  async function saveResult(next: Result) {
    const prev = localResult
    setLocalResult(next)
    try {
      await updateTestcaseResult(tc.id, next)
      router.refresh()
    } catch (err) {
      setLocalResult(prev)
      alert((err as Error).message)
    }
  }

  function change(next: Result) {
    setOpen(false)
    if (next === localResult) return
    if (next === 'FAIL') {
      // FAIL 이면 먼저 팝업 → 사용자가 아니오/예 선택
      setAskJira(true)
      startTransition(async () => { await saveResult(next) })
      return
    }
    startTransition(async () => { await saveResult(next) })
  }

  const isEmpty = !localResult
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={`
          inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full
          hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-400
          ${isEmpty ? 'border border-dashed border-gray-300 text-gray-400 bg-white' : RESULT_STYLE[localResult!]}
          ${isPending ? 'opacity-60' : ''}
        `}
      >
        {localResult ?? '선택'}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[110px]">
            {RESULTS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => change(r)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${RESULT_STYLE[r]}`}>
                  {r}
                </span>
                {r === localResult && <span className="ml-2 text-yellow-600">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {askJira && (
        <JiraConfirmModal
          onNo={() => setAskJira(false)}
          onYes={() => { setAskJira(false); setShowContent(true) }}
        />
      )}
      {showContent && (
        <JiraContentModal tc={tc} onClose={() => setShowContent(false)} />
      )}
    </div>
  )
}

function TypeDropdown({ tcId, current }: { tcId: string; current: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // 기존 값(수동/자동 등)이면 화면상 '기능'으로 표시
  const initial = TC_TYPES.includes(current) ? current : '기능'
  const [localType, setLocalType] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function change(next: string) {
    setOpen(false)
    if (next === localType) return
    const prev = localType
    setLocalType(next)
    startTransition(async () => {
      try {
        await updateTestcaseType(tcId, next)
        router.refresh()
      } catch (err) {
        setLocalType(prev)
        alert((err as Error).message)
      }
    })
  }

  const style = TC_TYPE_STYLE[localType] ?? 'bg-gray-100 text-gray-700'
  const label = localType

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={`
          inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full
          hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-400
          ${style}
          ${isPending ? 'opacity-60' : ''}
        `}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[110px]">
            {TC_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => change(t)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${TC_TYPE_STYLE[t]}`}>
                  {t}
                </span>
                {t === localType && <span className="ml-2 text-yellow-600">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function JiraLinkField({ tcId, current }: { tcId: string; current: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(current ?? '')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(current ?? '') }, [current])
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function save() {
    if (draft.trim() === (current ?? '').trim()) { setEditing(false); return }
    startTransition(async () => {
      try {
        await updateTestcaseJiraLink(tcId, draft)
        setEditing(false)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save() }
          else if (e.key === 'Escape') { setDraft(current ?? ''); setEditing(false) }
        }}
        disabled={isPending}
        placeholder="https://themoin.atlassian.net/browse/..."
        className="w-full px-2 py-1 text-sm border border-yellow-400 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-300"
      />
    )
  }

  if (current) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={current}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline truncate max-w-[380px]"
        >
          {current}
        </a>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-gray-700"
        >
          수정
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-xs text-gray-400 hover:text-gray-700 border border-dashed border-gray-300 rounded px-2 py-0.5"
    >
      + JIRA 링크 추가
    </button>
  )
}

function JiraConfirmModal({ onNo, onYes }: { onNo: () => void; onYes: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onNo}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl p-6 w-[420px] max-w-[90vw]"
      >
        <h3 className="text-base font-bold text-gray-900 mb-2">지라(JIRA)에 티켓을 등록할까요?</h3>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          확인결과가 FAIL 로 저장되었어요.<br />
          이 TC에 대한 이슈를 지라에 등록하시겠어요?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onNo}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            아니오
          </button>
          <button
            type="button"
            onClick={onYes}
            className="px-4 py-2 text-sm bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 font-medium"
          >
            예, 등록할게요
          </button>
        </div>
      </div>
    </div>
  )
}

function JiraContentModal({ tc, onClose }: { tc: TC; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const content = [
    '[사전 조건]',
    tc.precondition ?? '(없음)',
    '',
    '[재현 절차]',
    tc.procedure ?? '(없음)',
    '',
    '[기대 결과]',
    tc.expected ?? '(없음)',
  ].join('\n')

  const title = `[Bug] ${tc.title}`

  async function copyBoth() {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${content}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('복사 실패 - 브라우저 권한을 확인해 주세요')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-[640px] max-w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-base font-bold text-gray-900">JIRA 이슈 내용 (복사해서 붙여넣기)</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-900 leading-relaxed">
            💡 JIRA API 연동은 곧 지원 예정. 지금은 아래 내용을 복사해서 JIRA 이슈를 만든 뒤,
            <br />TC 상세의 <strong>JIRA 링크</strong> 필드에 이슈 URL을 붙여넣어 주세요.
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">제목</div>
            <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm font-medium">
              {title}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">본문</div>
            <pre className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
{content}
            </pre>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center sticky bottom-0 bg-white">
          <a
            href="https://themoin.atlassian.net/jira/your-work"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            JIRA 열기 ↗
          </a>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={copyBoth}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-yellow-400 text-black hover:bg-yellow-500'
              }`}
            >
              {copied ? '✓ 복사됨!' : '제목+본문 복사'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EnvironmentDropdown({ tcId, current }: { tcId: string; current: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [localEnv, setLocalEnv] = useState(current)
  const [isPending, startTransition] = useTransition()

  function change(next: string) {
    setOpen(false)
    if (next === localEnv) return
    const prev = localEnv
    setLocalEnv(next)
    startTransition(async () => {
      try {
        await updateTestcaseEnvironment(tcId, next)
        router.refresh()
      } catch (err) {
        setLocalEnv(prev)
        alert((err as Error).message)
      }
    })
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={`
          inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full
          hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-400
          ${ENV_STYLE[localEnv] ?? 'bg-gray-100 text-gray-700'}
          ${isPending ? 'opacity-60' : ''}
        `}
      >
        {localEnv}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[110px]">
            {ENVIRONMENTS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => change(e)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${ENV_STYLE[e] ?? 'bg-gray-100 text-gray-700'}`}>
                  {e}
                </span>
                {e === localEnv && <span className="ml-2 text-yellow-600">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PriorityDropdown({ tcId, current }: { tcId: string; current: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [localPriority, setLocalPriority] = useState(current)
  const [isPending, startTransition] = useTransition()

  function change(next: string) {
    setOpen(false)
    if (next === localPriority) return
    const prev = localPriority
    setLocalPriority(next)
    startTransition(async () => {
      try {
        await updateTestcasePriority(tcId, next)
        router.refresh()
      } catch (err) {
        setLocalPriority(prev)
        alert((err as Error).message)
      }
    })
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={`
          inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full
          hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-400
          ${PRIORITY_STYLE[localPriority] ?? 'bg-gray-100 text-gray-700'}
          ${isPending ? 'opacity-60' : ''}
        `}
      >
        {localPriority}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[110px]">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => change(p)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${PRIORITY_STYLE[p] ?? 'bg-gray-100 text-gray-700'}`}>
                  {p}
                </span>
                {p === localPriority && <span className="ml-2 text-yellow-600">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DetailView({ tc, comments }: { tc: TC; comments: Comment[] }) {
  return (
    <div className="space-y-6">
      {/* 메타 정보 그리드 */}
      <dl className="grid grid-cols-[130px_1fr] gap-y-3 gap-x-4 text-sm">
        <dt className="text-gray-500">우선순위</dt>
        <dd>
          <PriorityDropdown tcId={tc.id} current={tc.priority} />
        </dd>

        <dt className="text-gray-500">타입</dt>
        <dd>
          <TypeDropdown tcId={tc.id} current={tc.type} />
        </dd>

        <dt className="text-gray-500">환경</dt>
        <dd>
          <EnvironmentDropdown tcId={tc.id} current={tc.environment} />
        </dd>

        <dt className="text-gray-500">확인결과</dt>
        <dd>
          <ResultDropdown tc={tc} />
        </dd>

        <dt className="text-gray-500">JIRA 링크</dt>
        <dd>
          <JiraLinkField tcId={tc.id} current={tc.jira_link} />
        </dd>
      </dl>

      <hr className="border-gray-200" />

      {/* 사전 조건 */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">사전 조건</h3>
        <InlineEditableText tcId={tc.id} field="precondition" value={tc.precondition} multiline />
      </div>

      {/* 재현 절차 */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">재현 절차</h3>
        <InlineEditableText tcId={tc.id} field="procedure" value={tc.procedure} multiline />
      </div>

      {/* 기대 결과 */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">기대 결과</h3>
        <InlineEditableText tcId={tc.id} field="expected" value={tc.expected} multiline />
      </div>

      {/* 비고 */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">비고</h3>
        <InlineEditableText tcId={tc.id} field="notes" value={tc.notes} multiline placeholder="(비어있음 - 클릭해서 추가)" />
      </div>

      <hr className="border-gray-200" />

      {/* 코멘트 섹션 */}
      <CommentSection testcaseId={tc.id} comments={comments} />

      <hr className="border-gray-200" />

      {/* 작성/수정 정보 (제일 하단) */}
      <div className="text-sm text-gray-500 space-y-1">
        <div>작성: {tc.author_name ?? '김초롱'} / {formatDateTime(tc.created_at)}</div>
        <div>수정: {tc.author_name ?? '김초롱'} / {formatDateTime(tc.updated_at)}</div>
      </div>
    </div>
  )
}

function HistoryView({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-gray-400">
        아직 수정 이력이 없습니다.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 mb-2">총 {history.length}건</div>
      <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
        {history.map((h) => (
          <div key={h.id} className="py-3 flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900">{h.editor_name ?? '-'}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-700">{h.action}</span>
              </div>
              {h.details && (
                <div className="text-xs text-gray-500 mt-1 font-mono">{h.details}</div>
              )}
              <div className="text-xs text-gray-400 mt-1 font-mono">
                {formatDateTime(h.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CommentSection({ testcaseId, comments }: { testcaseId: string; comments: Comment[] }) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    if (!content.trim()) {
      setError('코멘트 내용을 입력하세요')
      return
    }
    startTransition(async () => {
      try {
        await createComment(testcaseId, content)
        setContent('')
        setError(null)
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function handleCancel() {
    setContent('')
    setError(null)
  }

  function handleDelete(commentId: string) {
    if (!confirm('이 코멘트를 삭제하시겠어요?')) return
    startTransition(async () => {
      try {
        await deleteComment(commentId, testcaseId)
        router.refresh()
      } catch (err) {
        alert((err as Error).message)
      }
    })
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-base font-semibold text-gray-900">코멘트</span>
        {comments.length > 0 && (
          <span className="text-xs text-gray-500">({comments.length})</span>
        )}
      </div>

      {/* 코멘트 목록 (타이틀과 입력창 사이) */}
      {comments.length > 0 && (
        <div className="divide-y divide-gray-200 border-t border-b border-gray-200 mb-4">
          {comments.map((c) => (
            <div key={c.id} className="py-4 group">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold text-gray-900">
                    {c.author_name || '익명'}
                  </span>
                  <span className="text-xs text-gray-500 ml-2 font-mono">
                    {formatDateTime(c.created_at)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  disabled={isPending}
                  title="코멘트 삭제"
                  className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {c.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 입력 폼 (목록 아래) */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="코멘트를 입력하세요"
          rows={3}
          disabled={isPending}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
        />
        {error && (
          <div className="text-xs text-red-600">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="px-3.5 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !content.trim()}
            className="px-3.5 py-1.5 text-sm bg-yellow-400 text-black rounded-md hover:bg-yellow-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditForm({
  tc,
  onCancel,
  onSubmit,
}: {
  tc: TC
  onCancel: () => void
  onSubmit: (fd: FormData) => void | Promise<void>
}) {
  return (
    <form action={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">제목 <span className="text-red-500">*</span></label>
        <input
          name="title"
          required
          defaultValue={tc.title}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">우선순위</label>
          <select
            name="priority"
            defaultValue={tc.priority}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">환경</label>
          <input
            name="environment"
            defaultValue={tc.environment}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>
      <input type="hidden" name="type" defaultValue={tc.type ?? '기능'} />
      <input type="hidden" name="status" defaultValue={tc.status ?? '정상'} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">작성자</label>
        <input
          name="author_name"
          defaultValue={tc.author_name ?? ''}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">사전 조건</label>
        <textarea
          name="precondition"
          rows={3}
          defaultValue={tc.precondition ?? ''}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">재현 절차</label>
        <textarea
          name="procedure"
          rows={5}
          defaultValue={tc.procedure ?? ''}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">기대 결과</label>
        <textarea
          name="expected"
          rows={5}
          defaultValue={tc.expected ?? ''}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">비고</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={tc.notes ?? ''}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
        >
          취소
        </button>
        <button
          type="submit"
          className="px-5 py-2.5 text-sm bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 font-medium shadow-sm"
        >
          저장
        </button>
      </div>
    </form>
  )
}
