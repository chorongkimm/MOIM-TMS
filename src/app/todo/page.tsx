import { createClient } from '@/lib/supabase/server'
import { AppShell } from '../_components/AppShell'
import { TodoBoard } from './TodoBoard'

export default async function TodoPage() {
  const supabase = await createClient()
  const { data: todos } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <AppShell currentPath="/todo">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Todo</div>
        <h1 className="text-lg font-bold text-gray-900 mt-0.5">할 일 스티커</h1>
      </header>
      <TodoBoard todos={todos ?? []} />
    </AppShell>
  )
}
