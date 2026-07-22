'use client'

import { useEffect } from 'react'

export function PrintClient() {
  useEffect(() => {
    // 페이지 로드 후 잠깐 여유를 두고 인쇄 다이얼로그 자동 오픈
    const timer = setTimeout(() => {
      window.print()
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  return null
}
