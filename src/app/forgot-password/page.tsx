'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Gauge } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENV !== 'development') {
      router.replace('/')
    }
  }, [router])

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (authError) {
      setError('メールの送信に失敗しました。メールアドレスをご確認ください。')
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 mb-4">
            <Gauge className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">測定器在庫管理</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">パスワードをお忘れの方</CardTitle>
            <CardDescription>
              登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-700">
                    再設定用のメールを送信しました。メールボックスをご確認ください。
                  </AlertDescription>
                </Alert>
                <a href="/" className="block text-center text-sm text-gray-500 hover:text-gray-700 underline underline-offset-4">
                  ログイン画面に戻る
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@company.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '送信中...' : '再設定メールを送信'}
                </Button>
                <div className="text-center">
                  <a href="/" className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-4">
                    ログイン画面に戻る
                  </a>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
