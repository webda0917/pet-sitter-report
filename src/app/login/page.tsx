'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'ログインに失敗しました')
      }
      window.location.href = '/'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインに失敗しました')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-gray-50 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-3">
        <img src="/logo.svg" alt="ハピフリ" className="h-16 mx-auto" />
        <p className="text-sm text-gray-500">スタッフ用パスワードを入力してください</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          autoComplete="current-password"
          autoFocus
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !password}
          className="w-full bg-emerald-600 text-white py-4 rounded-2xl text-base font-bold shadow-md active:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? '確認中…' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}
