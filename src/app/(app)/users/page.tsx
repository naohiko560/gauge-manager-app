import { requireAdmin } from '@/lib/requireAdmin'
import { UsersClient } from './UsersClient'

export default async function UsersPage() {
  await requireAdmin()
  return <UsersClient />
}
