import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return Response.json({ error: 'ファイルが選択されていません' }, { status: 400 })
  if (file.type !== 'application/pdf') return Response.json({ error: 'PDFファイルのみアップロード可能です' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: 'ファイルサイズは10MB以下にしてください' }, { status: 400 })

  const admin = createAdminClient()
  const timestamp = Date.now()
  const path = `${user.id}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await admin.storage
    .from('calibration-certs')
    .upload(path, arrayBuffer, { contentType: 'application/pdf', upsert: false })

  if (error) {
    console.error('[calibration/upload] storage.upload', error.message)
    return Response.json({ error: 'ファイルのアップロードに失敗しました' }, { status: 500 })
  }

  // 署名付きURL (1時間有効)
  const { data: signedData, error: signedError } = await admin.storage
    .from('calibration-certs')
    .createSignedUrl(path, 60 * 60)

  if (signedError) {
    console.error('[calibration/upload] storage.signedUrl', signedError.message)
    return Response.json({ error: 'URLの生成に失敗しました' }, { status: 500 })
  }

  return Response.json({ url: signedData.signedUrl, path })
}
