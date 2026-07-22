import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ImportForm } from './ImportForm'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ImportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const selectedPrefix = typeof params.project === 'string' ? params.project : ''

  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('name, tc_prefix')
    .order('created_at')

  // URL 로 넘어온 프로젝트 코드에 해당하는 이름 찾기 (초기값)
  const initialProjectName = selectedPrefix
    ? projects?.find((p) => p.tc_prefix === selectedPrefix)?.name ?? ''
    : ''

  const backHref = selectedPrefix ? `/testcases?project=${selectedPrefix}` : '/testcases'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-8 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            href={backHref}
            className="text-gray-400 hover:text-gray-600"
            aria-label="뒤로"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">XLSX 가져오기</h1>
        </div>
      </div>
      <ImportForm projects={projects ?? []} initialProjectName={initialProjectName} backHref={backHref} />
    </div>
  )
}
