'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import type { Client } from '@/types'
import { getClients } from '@/lib/storage'
import ClientManager from '@/components/ClientManager'
import ReportForm from '@/components/ReportForm'
import ReportPreview from '@/components/ReportPreview'

type View = 'home' | 'clients' | 'report' | 'preview'

export default function Home() {
  const [view, setView] = useState<View>('home')
  const [clients, setClients] = useState<Client[]>([])
  const [report, setReport] = useState('')

  const loadClients = async () => {
    try { setClients(await getClients()) } catch { setClients([]) }
  }

  useEffect(() => { loadClients() }, [])

  const handleStartReport = async () => {
    const fresh = await getClients().catch(() => [] as Client[])
    const hasPets = fresh.some((c) => c.pets.length > 0)
    if (fresh.length === 0) { alert('まず顧客・ペットを登録してください'); setView('clients'); return }
    if (!hasPets) { alert('ペットを登録してください'); setView('clients'); return }
    setClients(fresh)
    setView('report')
  }

  if (view === 'clients') {
    return (
      <ClientManager
        onBack={() => { loadClients(); setView('home') }}
      />
    )
  }

  if (view === 'report') {
    return (
      <ReportForm
        clients={clients.filter((c) => c.pets.length > 0)}
        onGenerate={(text) => { setReport(text); setView('preview') }}
        onBack={() => setView('home')}
      />
    )
  }

  if (view === 'preview') {
    return (
      <ReportPreview
        report={report}
        onEdit={() => setView('report')}
        onNew={() => { setReport(''); setView('home') }}
      />
    )
  }

  const petCount = clients.reduce((s, c) => s + c.pets.length, 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center space-y-3">
          <img src="/logo.svg" alt="ハピフリ" className="h-16 mx-auto" />
          <p className="text-sm text-gray-500">音声入力 → AI が報告文を作成 → LINEで送信</p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={handleStartReport}
            className="w-full bg-emerald-600 text-white py-5 rounded-2xl text-lg font-bold shadow-lg active:bg-emerald-700 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新しい報告書を作成
          </button>

          <button
            onClick={() => setView('clients')}
            className="w-full border border-gray-300 bg-white text-gray-700 py-4 rounded-2xl text-sm font-medium shadow-sm active:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            顧客・ペット管理
          </button>
        </div>

        {clients.length > 0 && (
          <p className="text-xs text-gray-400">
            {clients.length}件の顧客 / {petCount}頭登録済み
          </p>
        )}
      </div>

      <footer className="text-center text-xs text-gray-400 pb-8">
        ハピフリ お世話報告書
      </footer>
    </div>
  )
}
