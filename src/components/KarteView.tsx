'use client'

import { useState, useRef, useMemo, useLayoutEffect } from 'react'
import type { Client, Karte, PetType } from '@/types'
import { getVisibleSections } from '@/lib/karteSections'
import { saveKarte, extractKarte } from '@/lib/storage'

interface Props {
  client: Client
  onClose: () => void
  onSaved?: (karte: Karte, updatedAt: string | null) => void
}

const MAX_IMAGES = 6
const MAX_EDGE = 1600
// Vercel のリクエスト上限（4.5MB）に収めるための目安
const MAX_TOTAL_BASE64 = 3_800_000

// 写真を長辺1600pxのJPEGに縮小し、base64（ヘッダーなし）で返す
async function resizeToBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('画像を読み込めませんでした'))
      el.src = url
    })
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
  } finally {
    URL.revokeObjectURL(url)
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default function KarteView({ client, onClose, onSaved }: Props) {
  const [karte, setKarte] = useState<Karte>(client.karte ?? {})
  const [updatedAt, setUpdatedAt] = useState<string | null>(client.karteUpdatedAt ?? null)
  const [draft, setDraft] = useState<Karte | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const petTypes = useMemo(() => Array.from(new Set(client.pets.map((p) => p.type))) as PetType[], [client.pets])
  const sections = useMemo(() => getVisibleSections(petTypes), [petTypes])
  const isEditing = draft !== null
  const isEmpty = sections.every((s) => !karte[s.key]?.trim())

  const startEdit = () => { setDraft({ ...karte }); setNotice(''); setError('') }

  const cancelEdit = () => {
    if (JSON.stringify(draft) !== JSON.stringify(karte) && !confirm('編集中の内容を破棄してよいですか？')) return
    setDraft(null)
    setNotice('')
    setError('')
  }

  const handleSave = async () => {
    if (!draft) return
    setIsSaving(true)
    setError('')
    try {
      // 空のセクションは保存しない
      const cleaned: Karte = {}
      for (const [k, v] of Object.entries(draft)) if (v.trim()) cleaned[k] = v.trim()
      const at = await saveKarte(client.id, cleaned)
      setKarte(cleaned)
      setUpdatedAt(at)
      setDraft(null)
      setNotice('')
      onSaved?.(cleaned, at)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    setNotice('')
    if (files.length > MAX_IMAGES) {
      setError(`写真は1回に${MAX_IMAGES}枚までです。分けて読み取ってください。`)
      return
    }
    setIsExtracting(true)
    try {
      const images = await Promise.all(Array.from(files).map(resizeToBase64))
      if (images.reduce((n, s) => n + s.length, 0) > MAX_TOTAL_BASE64) {
        throw new Error('写真の容量が大きすぎます。枚数を減らして読み取ってください。')
      }
      const extracted = await extractKarte(images, petTypes)
      const keys = Object.keys(extracted)
      if (keys.length === 0) {
        setError('写真から読み取れる内容がありませんでした。')
        return
      }
      // 既存の記入は上書きせず、下に追記する
      const base = draft ?? karte
      const next: Karte = { ...base }
      for (const k of keys) {
        next[k] = base[k]?.trim() ? `${base[k].trim()}\n\n【読み取り分】\n${extracted[k]}` : extracted[k]
      }
      setDraft(next)
      setNotice(`${keys.length}個のセクションに読み取った内容を入れました。内容を確認・修正して「保存」を押してください。`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み取りに失敗しました')
    } finally {
      setIsExtracting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-gray-100 overflow-y-auto">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={isEditing ? cancelEdit : onClose} className="text-gray-600 hover:text-gray-800 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-800 truncate">{client.name} のカルテ</p>
          {updatedAt && !isEditing && <p className="text-xs text-gray-400">最終更新 {formatDate(updatedAt)}</p>}
        </div>
        {isEditing ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg font-bold disabled:opacity-50"
          >
            {isSaving ? '保存中…' : '保存'}
          </button>
        ) : (
          <button onClick={startEdit} className="border border-gray-300 bg-white text-gray-700 text-sm px-4 py-2 rounded-lg font-medium">
            編集
          </button>
        )}
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-10">
        <p className="text-sm text-gray-600">
          {client.pets.map((p) => `${p.type === 'dog' ? '🐶' : '🐱'} ${p.name}`).join('　')}
        </p>

        {/* 写真から読み取る */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isExtracting || isSaving}
          className="w-full bg-white border border-emerald-300 text-emerald-700 py-4 rounded-2xl text-base font-bold shadow-sm active:bg-emerald-50 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isExtracting ? (
            <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>写真を読み取り中…（30秒ほどかかります）</>
          ) : (
            <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>写真から読み取る</>
          )}
        </button>
        <p className="text-xs text-gray-500 -mt-2">
          記入済みのヒアリングシートやメモの写真を選ぶと、内容を読み取って各項目に入れます（1回{MAX_IMAGES}枚まで）。写真は保存されません。
        </p>

        {notice && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm px-4 py-3 rounded-xl">{notice}</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {!isEditing && isEmpty && (
          <p className="text-center text-gray-400 py-8 text-sm">
            まだ記入されていません。<br />「編集」か「写真から読み取る」で記入してください。
          </p>
        )}

        {sections.map((s) => {
          const value = (draft ? draft[s.key] : karte[s.key]) ?? ''
          if (!draft) {
            if (!value.trim()) return null
            return (
              <section key={s.key} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-bold text-emerald-700 mb-2">{s.label}</h2>
                <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{value}</p>
              </section>
            )
          }
          return (
            <section key={s.key} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-emerald-700">{s.label}</h2>
                {!value.trim() && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, [s.key]: s.guide })}
                    className="text-sm text-gray-500 underline"
                  >
                    項目名を入れる
                  </button>
                )}
              </div>
              <AutoTextarea
                value={value}
                onChange={(v) => setDraft({ ...draft, [s.key]: v })}
                placeholder={s.guide}
              />
            </section>
          )
        })}

        {isEditing && (
          <div className="flex gap-3">
            <button onClick={cancelEdit} className="flex-1 border border-gray-300 bg-white text-gray-700 py-4 rounded-2xl text-base font-medium">
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl text-base font-bold shadow-md disabled:opacity-50"
            >
              {isSaving ? '保存中…' : '保存'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// 内容の行数（折り返しを含む）に合わせて高さが伸びる記入欄
function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      placeholder={placeholder}
      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-800 leading-relaxed bg-gray-50 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
  )
}
