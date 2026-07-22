'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function slugPrefix(name: string): string {
  const alnum = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (alnum.length >= 2) return alnum.slice(0, 3)
  return 'P' + Date.now().toString(36).slice(-3).toUpperCase()
}

export async function createProject(
  name: string,
  prefixInput: string,
): Promise<{ id: string; tc_prefix: string; name: string }> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('프로젝트명을 입력하세요')
  if (trimmedName.length > 100) throw new Error('프로젝트명이 너무 깁니다 (100자 이하)')

  const supabase = await createClient()

  // 같은 이름 존재하면 그것을 반환 (idempotent)
  const { data: existing } = await supabase
    .from('projects')
    .select('id, tc_prefix, name')
    .eq('name', trimmedName)
    .maybeSingle()
  if (existing) return existing

  // prefix 결정
  const basePrefix = (prefixInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    || slugPrefix(trimmedName)).slice(0, 10)
  let finalPrefix = basePrefix
  for (let i = 2; i <= 99; i++) {
    const { data: dup } = await supabase
      .from('projects')
      .select('id')
      .eq('tc_prefix', finalPrefix)
      .maybeSingle()
    if (!dup) break
    finalPrefix = basePrefix + i
  }

  const { data: created, error } = await supabase
    .from('projects')
    .insert({ name: trimmedName, tc_prefix: finalPrefix })
    .select('id, tc_prefix, name')
    .single()
  if (error || !created) throw new Error(`생성 실패: ${error?.message ?? ''}`)

  revalidatePath('/', 'layout')
  return created
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient()
  // domains, testcases 는 FK on delete cascade 로 자동 삭제됨
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw new Error(`스프린트 삭제 실패: ${error.message}`)
  revalidatePath('/', 'layout')
}

export async function deleteDomain(id: string): Promise<void> {
  const supabase = await createClient()
  // testcases.domain_id 는 on delete set null 이지만, 도메인 자체를 지우면 TC는 살아있음.
  // 사용자가 "폴더 안의 TC까지 지우고 싶다"고 하면 별도 처리 필요. 지금은 폴더만 삭제 → TC는 (폴더 미지정) 으로 이동.
  const { error } = await supabase.from('domains').delete().eq('id', id)
  if (error) throw new Error(`폴더 삭제 실패: ${error.message}`)
  revalidatePath('/', 'layout')
}

export async function moveProject(id: string, direction: 'up' | 'down'): Promise<void> {
  const supabase = await createClient()

  // 현재 표시 순서 (sort_order → created_at) 로 프로젝트 목록 조회
  const { data: all } = await supabase
    .from('projects')
    .select('id')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!all || all.length < 2) return

  const idx = all.findIndex((p) => p.id === id)
  if (idx === -1) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return

  // 인접 두 프로젝트 스왑
  const reordered = [...all]
  ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]

  // 전체 sort_order 재기입 (10 간격)
  for (let i = 0; i < reordered.length; i++) {
    await supabase.from('projects').update({ sort_order: (i + 1) * 10 }).eq('id', reordered[i].id)
  }

  revalidatePath('/', 'layout')
}

const ALLOWED_DOMAIN_COLORS = new Set([
  'red', 'orange', 'amber', 'yellow', 'lime', 'green',
  'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo',
  'violet', 'purple', 'pink', 'rose', 'gray',
])

export async function updateDomainName(id: string, newName: string): Promise<void> {
  const trimmed = newName.trim()
  if (!trimmed) throw new Error('폴더명을 입력하세요')
  if (trimmed.length > 100) throw new Error('폴더명이 너무 깁니다 (100자 이하)')
  const supabase = await createClient()
  const { error } = await supabase
    .from('domains')
    .update({ name: trimmed })
    .eq('id', id)
  if (error) throw new Error(`폴더명 저장 실패: ${error.message}`)
  revalidatePath('/', 'layout')
}

export async function updateDomainColor(id: string, color: string | null): Promise<void> {
  if (color && !ALLOWED_DOMAIN_COLORS.has(color)) {
    throw new Error(`유효하지 않은 색상: ${color}`)
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('domains')
    .update({ color })
    .eq('id', id)
  if (error) throw new Error(`색상 저장 실패: ${error.message}`)

  revalidatePath('/', 'layout')
}

export async function moveDomain(id: string, direction: 'up' | 'down'): Promise<void> {
  const supabase = await createClient()

  const { data: target } = await supabase
    .from('domains')
    .select('id, project_id')
    .eq('id', id)
    .maybeSingle()
  if (!target) throw new Error('폴더를 찾을 수 없어요')

  // 현재 표시 순서(sort_order → created_at) 로 정렬
  const { data: all } = await supabase
    .from('domains')
    .select('id')
    .eq('project_id', target.project_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!all || all.length < 2) return

  const idx = all.findIndex((d) => d.id === id)
  if (idx === -1) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return

  // 인접 두 항목 스왑
  const reordered = [...all]
  ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]

  // 전체를 정규화된 sort_order 로 재기입 (10 간격, 나중에 삽입 여유)
  for (let i = 0; i < reordered.length; i++) {
    await supabase.from('domains').update({ sort_order: (i + 1) * 10 }).eq('id', reordered[i].id)
  }

  revalidatePath('/', 'layout')
}

// 기존 sort_order 가 모두 0 인 도메인들을 create 시각 기준으로 재정렬
export async function normalizeDomainOrder(projectId: string): Promise<void> {
  const supabase = await createClient()
  const { data: all } = await supabase
    .from('domains')
    .select('id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (!all) return
  for (let i = 0; i < all.length; i++) {
    await supabase.from('domains').update({ sort_order: i + 1 }).eq('id', all[i].id)
  }
  revalidatePath('/', 'layout')
}

export async function deleteDomainWithTestcases(id: string): Promise<void> {
  const supabase = await createClient()
  // 폴더 안의 TC도 함께 삭제
  const { error: tcErr } = await supabase.from('testcases').delete().eq('domain_id', id)
  if (tcErr) throw new Error(`폴더 내 TC 삭제 실패: ${tcErr.message}`)
  const { error } = await supabase.from('domains').delete().eq('id', id)
  if (error) throw new Error(`폴더 삭제 실패: ${error.message}`)
  revalidatePath('/', 'layout')
}

export async function updateProjectDates(
  id: string,
  startDate: string | null,
  endDate: string | null,
): Promise<void> {
  // 빈 문자열은 null 로 처리
  const s = startDate?.trim() || null
  const e = endDate?.trim() || null

  // 기간 유효성 (둘 다 있을 때만 검증)
  if (s && e && s > e) {
    throw new Error('시작일이 종료일보다 늦을 수 없습니다')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('projects')
    .update({ start_date: s, end_date: e })
    .eq('id', id)
  if (error) throw new Error(`기간 저장 실패: ${error.message}`)

  revalidatePath('/', 'layout')
}

export async function updateProjectName(id: string, newName: string) {
  const trimmed = newName.trim()
  if (!trimmed) throw new Error('프로젝트명이 비어있습니다')
  if (trimmed.length > 100) throw new Error('프로젝트명이 너무 깁니다 (100자 이하)')

  const supabase = await createClient()

  // 이름 중복 체크 (다른 프로젝트에 같은 이름이 있는지)
  const { data: dup } = await supabase
    .from('projects')
    .select('id')
    .eq('name', trimmed)
    .neq('id', id)
    .maybeSingle()
  if (dup) throw new Error('같은 이름의 프로젝트가 이미 있습니다')

  const { error } = await supabase
    .from('projects')
    .update({ name: trimmed })
    .eq('id', id)

  if (error) throw new Error(`수정 실패: ${error.message}`)

  revalidatePath('/', 'layout')
}
