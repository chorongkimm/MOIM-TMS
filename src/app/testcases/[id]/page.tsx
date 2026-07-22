import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TestcaseDetail } from './TestcaseDetail'

type Params = Promise<{ id: string }>

export default async function TestcaseDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: tc } = await supabase
    .from('testcases')
    .select('*, projects(name, tc_prefix), domains(id, name)')
    .eq('id', id)
    .maybeSingle()

  if (!tc) return notFound()

  const [commentsRes, historyRes] = await Promise.all([
    supabase
      .from('tc_comments')
      .select('*')
      .eq('testcase_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tc_edit_history')
      .select('*')
      .eq('testcase_id', id)
      .order('created_at', { ascending: false }),
  ])

  const project = tc.projects as { name: string; tc_prefix: string } | null
  const tcCode = `NO_${String(tc.tc_no).padStart(3, '0')}`
  const backHref = project ? `/testcases?project=${project.tc_prefix}` : '/testcases'

  return <TestcaseDetail tc={tc} tcCode={tcCode} comments={commentsRes.data ?? []} history={historyRes.data ?? []} backHref={backHref} />
}
