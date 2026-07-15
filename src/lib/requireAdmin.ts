import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { AuthUser } from '@/types/database'

export async function requireAdmin(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) redirect('/')
  if (user.role !== 'admin') redirect('/dashboard')
  return user
}
