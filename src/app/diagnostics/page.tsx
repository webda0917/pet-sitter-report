'use client'

import { useEffect, useState } from 'react'

type Result = {
  ok: boolean
  key: { kind: string; hasSurroundingWhitespace: boolean; sameAsPublicKey: boolean }
  similarEnvNames: string[]
  storage: { ran: boolean; steps: { label: string; ok: boolean; detail?: string }[] }
}

// キーの種類ごとの判定と、次にやること
const KEY_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  secret: { ok: true, text: '専用キー（sb_secret_）が登録されています' },
  service_role_jwt: { ok: true, text: '専用キー（service_role）が登録されています' },
  missing: { ok: false, text: 'SUPABASE_SERVICE_ROLE_KEY という名前の環境変数が見つかりません。名前の打ち間違いの可能性があります' },
  empty: { ok: false, text: 'SUPABASE_SERVICE_ROLE_KEY は登録されていますが、値が空です' },
  publishable: { ok: false, text: '公開キー（sb_publishable_）が貼られています。Secret keys 側の値に差し替えが必要です' },
  anon_jwt: { ok: false, text: '公開キー（anon）が貼られています。service_role 側の値に差し替えが必要です' },
  unknown: { ok: false, text: 'Supabase のキーの形式ではない値が入っています。貼り付け間違いの可能性があります' },
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className={`shrink-0 font-bold ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{ok ? '○' : '×'}</span>
      <div className="text-sm text-gray-800">
        <p>{label}</p>
        {detail && <p className="text-xs text-gray-500 mt-1 break-all">{detail}</p>}
      </div>
    </li>
  )
}

export default function DiagnosticsPage() {
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/diagnostics/storage', { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 401) { window.location.href = '/login'; return }
        if (!res.ok) throw new Error(`診断を実行できませんでした（${res.status}）`)
        setResult(await res.json())
      })
      .catch((e) => setError(e instanceof Error ? e.message : '診断を実行できませんでした'))
  }, [])

  const keyMsg = result ? KEY_MESSAGES[result.key.kind] ?? KEY_MESSAGES.unknown : null

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-lg font-bold text-gray-800 pt-2">専用キーの診断</h1>
        <p className="text-xs text-gray-500">
          顧客・ペットのデータには触れません。画像用の非公開の保存場所にテスト画像を置き、読み出せたら削除します。
        </p>

        {!result && !error && <p className="text-sm text-gray-500">診断中…</p>}
        {error && <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

        {result && keyMsg && (
          <>
            <div className={`rounded-xl px-4 py-4 text-base font-bold ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {result.ok ? '専用キーは正しく効いています' : '専用キーが効いていません'}
            </div>

            <section className="bg-white rounded-xl px-4 shadow-sm">
              <ul>
                <Row ok={keyMsg.ok} label={keyMsg.text} />
                {result.key.hasSurroundingWhitespace && (
                  <Row ok={false} label="値の前後に空白または改行が入っています" />
                )}
                {result.key.sameAsPublicKey && (
                  <Row ok={false} label="NEXT_PUBLIC_SUPABASE_ANON_KEY と同じ値が入っています" />
                )}
                {result.storage.steps.map((s, i) => (
                  <Row key={i} ok={s.ok} label={s.label} detail={s.detail} />
                ))}
                {!result.storage.ran && <Row ok={false} label="キーが無いため、保存のテストは行っていません" />}
              </ul>
            </section>

            <section className="bg-white rounded-xl px-4 py-3 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Supabase 関連の環境変数（名前のみ）</p>
              <p className="text-sm text-gray-800 break-all">{result.similarEnvNames.join('、') || 'なし'}</p>
            </section>
          </>
        )}

        <a href="/" className="block text-center text-sm text-emerald-700 py-3">ホームに戻る</a>
      </div>
    </div>
  )
}
