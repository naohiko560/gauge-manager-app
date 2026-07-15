'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useIsAdmin } from '@/lib/AuthContext'
import { User, UserRole } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, Users } from 'lucide-react'
import { SortableHead } from '@/components/ui/SortableHead'
import { useSortTable, sortRows } from '@/hooks/useSortTable'

const IS_DEV = process.env.NEXT_PUBLIC_ENV === 'development'

const SYSTEM_NAME = 'instrument'

interface UserWithRole extends User {
  user_roles?: Array<{ id: string; system_name: string; role: UserRole }>
}

type FormData = {
  name: string
  email: string
  password: string
  is_active: boolean
  hired_date: string
  retirement_date: string
  role: UserRole | ''
}

const emptyForm = (): FormData => ({
  name: '', email: '', password: '', is_active: true,
  hired_date: '', retirement_date: '', role: 'worker',
})

const SYSTEM_NAME_SORT = 'instrument'

function getUserSortValue(user: UserWithRole, key: string): string | number | null | undefined {
  if (key === 'role') {
    const role = user.user_roles?.find((r) => r.system_name === SYSTEM_NAME_SORT)?.role
    return role === 'admin' ? '管理者' : role === 'worker' ? '作業者' : ''
  }
  return (user as any)[key]
}

async function fetchUsers(): Promise<UserWithRole[]> {
  const supabase = createClient()
  const { data } = await supabase.from('users').select('*, user_roles(id, system_name, role)').order('name')
  return data ?? []
}

export function UsersClient() {
  const router = useRouter()
  const isAdmin = useIsAdmin()
  const initialized = useRef(false)
  const { data: swrData, isLoading } = useSWR('users', fetchUsers, { revalidateOnFocus: false })

  const [users, setUsers] = useState<UserWithRole[]>([])
  const { sortKey, sortDir, handleSort } = useSortTable('name')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserWithRole | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserWithRole | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isAdmin) { router.replace('/dashboard'); return }
    if (!swrData || initialized.current) return
    initialized.current = true
    setUsers(swrData)
  }, [swrData, isAdmin, router])

  function flash(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setOpen(true)
  }

  function openEdit(user: UserWithRole) {
    setEditing(user)
    const roleRecord = user.user_roles?.find((r) => r.system_name === SYSTEM_NAME)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      is_active: user.is_active,
      hired_date: user.hired_date ?? '',
      retirement_date: user.retirement_date ?? '',
      role: (roleRecord?.role ?? '') as UserRole | '',
    })
    setError('')
    setOpen(true)
  }

  function getRole(user: UserWithRole): UserRole | null {
    return user.user_roles?.find((r) => r.system_name === SYSTEM_NAME)?.role ?? null
  }

  function getStatus(user: UserWithRole): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string } {
    if (!user.is_active) return { label: '無効', variant: 'destructive' }
    const today = new Date().toISOString().split('T')[0]
    if (user.retirement_date && today >= user.retirement_date) return { label: '退職済', variant: 'outline' }
    return { label: '有効', variant: 'default', className: 'bg-green-100 text-green-700 hover:bg-green-100' }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      setError('氏名とメールアドレスは必須です')
      return
    }
    if (!editing && !form.password.trim()) {
      setError('仮パスワードは必須です')
      return
    }
    if (!editing && form.password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }
    setSaving(true)
    setError('')

    if (editing) {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editing.id,
          name: form.name.trim(),
          email: form.email.trim(),
          is_active: form.is_active,
          hired_date: form.hired_date || null,
          retirement_date: form.retirement_date || null,
          role: form.role,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '更新に失敗しました'); setSaving(false); return }
      if (json.user) setUsers((prev) => prev.map((u) => (u.id === editing.id ? json.user : u)))
    } else {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          role: form.role,
          is_active: form.is_active,
          hired_date: form.hired_date || null,
          retirement_date: form.retirement_date || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '招待に失敗しました'); setSaving(false); return }
      if (json.user) setUsers((prev) => [...prev, json.user].sort((a, b) => a.name.localeCompare(b.name)))
    }

    setSaving(false)
    setOpen(false)
    flash(editing ? 'ユーザーを更新しました' : '招待メールを送信しました')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch('/api/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: deleteTarget.id }),
    })
    const json = await res.json()
    setDeleting(false)
    if (!res.ok) { setSuccessMsg(''); setError(json.error ?? '削除に失敗しました'); setDeleteTarget(null); return }
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
    setDeleteTarget(null)
    flash('ユーザーを削除しました')
  }

  if (isLoading || !initialized.current) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <PageTitle>【管理】ユーザー</PageTitle>
          <p className="text-sm text-gray-500 mt-1">全 {users.length} 名</p>
        </div>
        {IS_DEV && (
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> 新規追加
          </Button>
        )}
      </div>

      {successMsg && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-700">{successMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>氏名</SortableHead>
                <SortableHead sortKey="email" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>メールアドレス</SortableHead>
                <SortableHead sortKey="role" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>ロール</SortableHead>
                <SortableHead sortKey="is_active" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>ステータス</SortableHead>
                <SortableHead sortKey="hired_date" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>入社日</SortableHead>
                <SortableHead sortKey="retirement_date" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>退職日</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    ユーザーが登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                sortRows(users, sortKey, sortDir, getUserSortValue).map((user) => {
                  const role = getRole(user)
                  const status = getStatus(user)
                  return (
                    <TableRow key={user.id} className={IS_DEV ? 'cursor-pointer' : ''} onClick={IS_DEV ? () => openEdit(user) : undefined}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-gray-600">{user.email}</TableCell>
                      <TableCell>
                        {role ? (
                          <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
                            {role === 'admin' ? '管理者' : '作業者'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={status.className}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{user.hired_date ?? '-'}</TableCell>
                      <TableCell className="text-sm text-gray-500">{user.retirement_date ?? '-'}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ユーザーを削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            <span className="font-medium">{deleteTarget?.name}</span> を完全に削除します。この操作は取り消せません。
          </p>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
              {deleting ? '削除中...' : '削除する'}
            </Button>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setError('') }}>キャンセル</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 登録・編集ダイアログ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {editing ? 'ユーザーを編集' : '新規ユーザーを追加'}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">氏名 *</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="山田 太郎" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">メールアドレス *</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="taro@example.com" />
              </div>
              {!editing && (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">仮パスワード *</Label>
                  <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="6文字以上" autoComplete="new-password" />
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ロール</Label>
                <Select value={form.role} onValueChange={(v) => set('role', (v ?? 'worker') as UserRole)}>
                  <SelectTrigger><SelectValue placeholder="選択">{form.role === 'admin' ? '管理者' : form.role === 'worker' ? '作業者' : '選択'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理者</SelectItem>
                    <SelectItem value="worker">作業者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">アカウント状態</Label>
                <Select
                  value={form.is_active ? 'active' : 'inactive'}
                  onValueChange={(v) => set('is_active', v === 'active')}
                >
                  <SelectTrigger><SelectValue>{form.is_active ? '有効' : '無効'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">有効</SelectItem>
                    <SelectItem value="inactive">無効</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">入社日</Label>
                <Input type="date" value={form.hired_date} onChange={(e) => set('hired_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">退職日</Label>
                <Input type="date" value={form.retirement_date} onChange={(e) => set('retirement_date', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? '保存中...' : '保存する'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
          </div>

          {editing && (
            <>
              <Separator />
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 mx-auto"
                onClick={() => { setDeleteTarget(editing); setOpen(false) }}
              >
                <Trash2 className="w-4 h-4" />
                このユーザーを削除する
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
