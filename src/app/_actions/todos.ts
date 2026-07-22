'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const DEFAULT_AUTHOR = '김초롱'
const ALLOWED_COLORS = new Set([
  'yellow', 'lime', 'red', 'sky',
  'pink', 'orange', 'purple', 'teal', 'amber', 'gray',
])

export async function createTodo(content: string, color: string): Promise<{ id: string }> {
  const c = ALLOWED_COLORS.has(color) ? color : 'yellow'
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('todos')
    .insert({
      content: content.trim(),
      color: c,
      author_name: DEFAULT_AUTHOR,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Todo 생성 실패: ${error?.message ?? ''}`)

  revalidatePath('/todo')
  return { id: data.id }
}

export async function updateTodoContent(id: string, content: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('todos')
    .update({ content: content.trim() })
    .eq('id', id)
  if (error) throw new Error(`Todo 저장 실패: ${error.message}`)
  revalidatePath('/todo')
}

export async function updateTodoColor(id: string, color: string): Promise<void> {
  if (!ALLOWED_COLORS.has(color)) throw new Error(`유효하지 않은 색상: ${color}`)
  const supabase = await createClient()
  const { error } = await supabase
    .from('todos')
    .update({ color })
    .eq('id', id)
  if (error) throw new Error(`색상 저장 실패: ${error.message}`)
  revalidatePath('/todo')
}

export async function toggleTodoDone(id: string, isDone: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('todos')
    .update({ is_done: isDone })
    .eq('id', id)
  if (error) throw new Error(`Todo 저장 실패: ${error.message}`)
  revalidatePath('/todo')
}

export async function deleteTodo(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('todos').delete().eq('id', id)
  if (error) throw new Error(`Todo 삭제 실패: ${error.message}`)
  revalidatePath('/todo')
}
