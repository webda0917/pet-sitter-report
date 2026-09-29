'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type { Client } from '@/types'

interface Props {
  clients: Client[]
  selectedClientId: string
  onSelect: (clientId: string) => void
}

// 全角/半角・カタカナ/ひらがな・大文字/小文字の違いを無視して比較するための正規化
function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '')
}

const petIcon = (type: string) => (type === 'dog' ? '🐶' : '🐱')

export default function ClientSearch({ clients, selectedClientId, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedClient = clients.find((c) => c.id === selectedClientId)

  // 顧客名・ふりがな・ペット名のどれでもヒットさせる
  const matches = useMemo(() => {
    const q = normalize(query)
    if (!q) return clients
    return clients.filter((c) =>
      [c.name, c.furigana ?? '', ...c.pets.map((p) => p.name)].some((name) => normalize(name).includes(q)),
    )
  }, [clients, query])

  // 候補リストの外をタップしたら閉じる
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [isOpen])

  const select = (id: string) => {
    onSelect(id)
    setQuery('')
    setIsOpen(false)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  if (selectedClient && !isOpen) {
    return (
      <div className="flex items-center gap-3 border border-emerald-300 bg-emerald-50 rounded-xl px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{selectedClient.name}</p>
          <p className="text-sm text-gray-600 truncate">
            {selectedClient.pets.map((p) => `${petIcon(p.type)} ${p.name}`).join('　')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="shrink-0 px-4 py-2 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 active:bg-gray-50"
        >
          変更
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <div className="relative">
        <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          placeholder="お客様名・ふりがな・ペット名で検索"
          autoComplete="off"
          autoFocus={!!selectedClient}
          enterKeyHint="search"
          className="w-full min-w-0 border border-gray-300 rounded-xl pl-12 pr-4 py-4 text-base text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {isOpen && (
        <ul className="mt-2 max-h-72 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
          {matches.length === 0 ? (
            <li className="px-4 py-4 text-sm text-gray-500">該当するお客様がいません</li>
          ) : (
            matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => select(c.id)}
                  className={`w-full text-left px-4 py-3 active:bg-emerald-50 ${c.id === selectedClientId ? 'bg-emerald-50' : ''}`}
                >
                  <p className="text-base font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">
                    {c.pets.map((p) => `${petIcon(p.type)} ${p.name}`).join('　')}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
