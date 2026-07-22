/**
 * 모든 날짜/시간을 한국 시간(KST, Asia/Seoul, UTC+9)으로 표시.
 * 서버가 UTC나 다른 지역에 있어도 결과는 항상 KST.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

// 내부: ISO 타임스탬프를 KST 로 변환한 Date (UTC getter 로 각 필드 추출)
function toKst(iso: string): Date {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS)
}

/**
 * ISO 타임스탬프 → 'YYYY. MM. DD. HH:mm:ss' (24시간, KST)
 */
export function formatDateTimeKR(iso: string): string {
  const d = toKst(iso)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  const s = String(d.getUTCSeconds()).padStart(2, '0')
  return `${y}. ${mo}. ${da}. ${h}:${mi}:${s}`
}

/**
 * 날짜 문자열(YYYY-MM-DD) 또는 ISO 를 'YYYY. MM. DD.' 로 표시.
 * DB의 date 컬럼(시간 없음) 은 timezone 변환 없이 그대로 표시.
 */
export function formatDateKR(iso: string | null | undefined): string {
  if (!iso) return ''
  // 'YYYY-MM-DD' 형태면 그대로 파싱 (timezone 변환 없음 - 날짜 자체를 표기)
  if (iso.length === 10 && iso[4] === '-' && iso[7] === '-') {
    const [y, mo, da] = iso.split('-')
    return `${y}. ${mo}. ${da}.`
  }
  // 전체 ISO 타임스탬프이면 KST 변환 후 날짜만
  const d = toKst(iso)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}. ${mo}. ${da}.`
}

/**
 * 오늘 날짜 (KST) 'YYYY-MM-DD'
 * DB 의 date 컬럼과 비교할 때 사용
 */
export function todayStrKR(): string {
  const d = new Date(new Date().getTime() + KST_OFFSET_MS)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/**
 * 날짜에 요일까지 표시: 'YYYY. MM. DD. (요일)'
 * 예: '2026. 07. 22. (수)'
 */
export function formatDateWithDayKR(iso: string | null | undefined): string {
  if (!iso) return ''
  const KOR_DAYS = ['일', '월', '화', '수', '목', '금', '토']
  let y: number, mo: number, da: number
  if (iso.length === 10 && iso[4] === '-' && iso[7] === '-') {
    // 'YYYY-MM-DD' 는 timezone 변환 없이 그대로 사용
    y = parseInt(iso.slice(0, 4))
    mo = parseInt(iso.slice(5, 7))
    da = parseInt(iso.slice(8, 10))
  } else {
    const d = toKst(iso)
    y = d.getUTCFullYear()
    mo = d.getUTCMonth() + 1
    da = d.getUTCDate()
  }
  // 요일 계산: UTC 자정 기준으로 계산해도 요일은 동일 (날짜만 알면 됨)
  const dayOfWeek = new Date(Date.UTC(y, mo - 1, da)).getUTCDay()
  return `${y}. ${String(mo).padStart(2, '0')}. ${String(da).padStart(2, '0')}. (${KOR_DAYS[dayOfWeek]})`
}
