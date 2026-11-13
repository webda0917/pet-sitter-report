'use client'

import { useEffect, useState } from 'react'
import type { Client, SavedReport } from '@/types'
import { getReports, deleteReport } from '@/lib/storage'

interface Props {
  client: Client
  onClose: () => void
}

// 新しい報告文を作るとき、AI に渡す直近の件数（/api/generate の HISTORY_COUNT と合わせる）
const HISTORY_COUNT = 3

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// お客様ごとの報告履歴（実際にコピーして送った報告文）
export default function ReportHistory({ client, onClose }: Props) {
  const [reports, setReports] = useState<SavedReport[] | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    getReports(client.id)
      .then(setReports)
      .catch((e) => setError(e instanceof Error ? e.message : '報告履歴の読み込みに失敗しました'))
  }, [client.id])

  const handleDelete = async (r: SavedReport) => {
    if (!confirm('この報告文を履歴から削除します。\n次回からの報告文づくりの参考にも使われなくなります。\n\nよろしいですか？')) return
    try {
      await deleteReport(r.id)
      setReports((prev) => prev?.filter((x) => x.id !== r.id) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-gray-100 overflow-y-auto">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onClose} className="text-gray-600 hover:text-gray-800 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="flex-1 min-w-0 text-base font-bold text-gray-800 truncate">{client.name} の報告履歴</p>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-10">
        <p className="text-sm text-gray-600 leading-relaxed">
          「テキストをコピー」を押した報告文が残ります。新しい報告文を作るときは、新しい順に{HISTORY_COUNT}件をAIが参考にします（書き方と、前回からの様子のつながり）。参考にしてほしくない報告文は削除してください。
        </p>

        {error && <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
        {!reports && !error && <p className="text-center text-gray-400 py-12 text-sm">読み込み中…</p>}
        {reports?.length === 0 && <p className="text-center text-gray-400 py-12 text-sm">まだ報告履歴はありません</p>}

        {reports?.map((r, i) => {
          const isOpen = openId === r.id
          return (
            <section key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <p className="flex-1 min-w-0 text-sm font-bold text-gray-800 truncate">{r.visitLabel || formatDate(r.createdAt)}</p>
                {i < HISTORY_COUNT && (
                  <span className="shrink-0 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">次回の参考</span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="shrink-0 text-xs text-red-500 px-2 py-1 rounded border border-red-200"
                >
                  削除
                </button>
              </div>
              <p className={`text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words ${isOpen ? '' : 'line-clamp-4'}`}>
                {r.body}
              </p>
              <button type="button" onClick={() => setOpenId(isOpen ? null : r.id)} className="mt-2 text-sm text-gray-500 underline">
                {isOpen ? '閉じる' : '全文を表示'}
              </button>
            </section>
          )
        })}
      </div>
    </div>
  )
}
