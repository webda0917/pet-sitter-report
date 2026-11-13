'use client'

import { useRef, useState } from 'react'
import type { ReportMeta } from '@/types'
import { saveReport } from '@/lib/storage'

interface Props {
  report: string
  meta: ReportMeta | null
  savedId: string | null
  onSaved: (id: string) => void
  onEdit: () => void
  onNew: () => void
}

export default function ReportPreview({ report, meta, savedId, onSaved, onEdit, onNew }: Props) {
  const [text, setText] = useState(report)
  const [copied, setCopied] = useState(false)
  const [historyStatus, setHistoryStatus] = useState<'' | 'saved' | 'error'>('')
  const lastSaved = useRef<string | null>(null)
  const idRef = useRef<string | null>(savedId)
  // 続けてコピーされても二重に保存しないよう、保存は1件ずつ順番に行う
  const queue = useRef<Promise<void>>(Promise.resolve())

  // コピーした文章（＝実際に送る文章）を履歴に残す。次回以降の報告文の作成で参考にする
  const saveHistory = (body: string) => {
    queue.current = queue.current.then(async () => {
      if (!meta || !body.trim() || body === lastSaved.current) return
      try {
        idRef.current = await saveReport(idRef.current, meta.clientId, meta.visitLabel, body)
        onSaved(idRef.current)
        lastSaved.current = body
        setHistoryStatus('saved')
      } catch {
        setHistoryStatus('error')
      }
    })
  }

  const handleCopy = async () => {
    saveHistory(text)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older iOS
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button onClick={onEdit} className="text-gray-500 hover:text-gray-700 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">報告文プレビュー</h1>
      </header>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full flex flex-col gap-4">
        {/* Copy banner */}
        <div className={`text-center text-sm font-medium py-2 rounded-lg transition-all ${
          copied ? 'bg-emerald-100 text-emerald-700' : 'bg-transparent text-transparent'
        }`}>
          ✓ コピーしました！LINEに貼り付けてください
        </div>

        {/* Editable report text */}
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-1">内容を直接修正できます</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-96 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white shadow-sm"
          />
        </div>

        {historyStatus === 'saved' && (
          <p className="text-xs text-gray-500 -mt-2">報告履歴に保存しました。次回からの報告文づくりの参考になります。</p>
        )}
        {historyStatus === 'error' && (
          <p className="text-xs text-red-600 -mt-2">報告履歴に保存できませんでした（コピーはできています）。</p>
        )}

        {/* Actions */}
        <div className="space-y-3 pb-6">
          <button
            onClick={handleCopy}
            className="w-full bg-emerald-600 text-white py-4 rounded-xl text-base font-bold shadow-md active:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            テキストをコピー
          </button>
          <button
            onClick={onNew}
            className="w-full border border-gray-300 text-gray-700 py-3.5 rounded-xl text-sm font-medium"
          >
            新しい報告書を作成
          </button>
        </div>
      </div>
    </div>
  )
}
