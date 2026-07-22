import { AppShell } from '../_components/AppShell'
import { PlaceholderTab } from '../_components/PlaceholderTab'

export default function AdministrationPage() {
  return (
    <AppShell currentPath="/administration">
      <PlaceholderTab
        title="Administration"
        description="사용자·권한·프로젝트 설정 관리."
      />
    </AppShell>
  )
}
