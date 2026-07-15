import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { AuthProvider } from '@/lib/AuthContext'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/')
  }

  return (
    <AuthProvider user={user}>
      <div className="flex h-screen overflow-hidden bg-muted/30">
        <Sidebar role={user.role} userName={user.name} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </AuthProvider>
  )
}
