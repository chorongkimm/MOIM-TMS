import Link from 'next/link'

export function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
        <p className="mt-4 text-xs text-gray-400">
          곧 지원 예정 (MOIN TMS MVP 다음 단계)
        </p>
        <Link
          href="/"
          className="mt-6 inline-block px-4 py-2 text-sm bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 font-medium"
        >
          대시보드로
        </Link>
      </div>
    </div>
  )
}
