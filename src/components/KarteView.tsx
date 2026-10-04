'use client'

import { useState, useRef, useMemo, useLayoutEffect } from 'react'
import type { Client, Karte, KarteImages, PetType } from '@/types'
import { getVisibleSections } from '@/lib/karteSections'
import { saveKarte, extractKarte, uploadKarteImage, discardKarteImages, karteImageUrl } from '@/lib/storage'

interface Props {
  client: Client
  onClose: () => void
  onSaved?: (karte: Karte, images: KarteImages, updatedAt: string | null) => void
}

const MAX_IMAGES = 6
const MAX_EDGE = 1600
// Vercel のリクエスト上限（4.5MB）に収めるための目安
const MAX_TOTAL_BASE64 = 3_800_000

// 添付画像：1セクション2枚まで。長辺2000pxに縮小し、iPhone の写真（3〜5MB）を数百KBにする
const MAX_ATTACH = 2
const ATTACH_MAX_EDGE = 2000
const ATTACH_QUALITY = 0.85

// 写真を長辺 maxEdge px に縮小したキャンバスを返す
async function drawResized(file: File, maxEdge: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('画像を読み込めませんでした'))
      el.src = url
    })
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    // 透過PNGをJPEGにしたとき黒くならないよう、白で下地を塗る
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 読み取り用：長辺1600pxのJPEGに縮小し、base64（ヘッダーなし）で返す
async function resizeToBase64(file: File): Promise<string> {
  const canvas = await drawResized(file, MAX_EDGE)
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
}

// 添付用：WebP で書き出せる端末は WebP、できない端末は JPEG にする
async function compressForAttachment(file: File): Promise<Blob> {
  const canvas = await drawResized(file, ATTACH_MAX_EDGE)
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, ATTACH_QUALITY))
  const webp = await toBlob('image/webp')
  if (webp?.type === 'image/webp') return webp
  const jpeg = await toBlob('image/jpeg')
  if (!jpeg) throw new Error('画像を変換できませんでした')
  return jpeg
}

const hasContent = (karte: Karte, images: KarteImages) =>
  Object.values(karte).some((v) => v.trim()) || Object.values(images).some((p) => p.length > 0)

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default function KarteView({ client, onClose, onSaved }: Props) {
  const [karte, setKarte] = useState<Karte>(client.karte ?? {})
  const [images, setImages] = useState<KarteImages>(client.karteImages ?? {})
  const [updatedAt, setUpdatedAt] = useState<string | null>(client.karteUpdatedAt ?? null)
  // 未記入のカルテは、最初から記入欄（編集モード）で開く
  const [draft, setDraft] = useState<Karte | null>(() =>
    hasContent(client.karte ?? {}, client.karteImages ?? {}) ? null : {},
  )
  const [draftImages, setDraftImages] = useState<KarteImages>(client.karteImages ?? {})
  // この編集中にアップロードした画像。保存しなかったものは後で消す
  const uploadedRef = useRef<string[]>([])
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const attachRef = useRef<HTMLInputElement>(null)
  const attachKeyRef = useRef<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const petTypes = useMemo(() => Array.from(new Set(client.pets.map((p) => p.type))) as PetType[], [client.pets])
  const sections = useMemo(() => getVisibleSections(petTypes), [petTypes])
  const isEditing = draft !== null
  const startEdit = (key?: string) => {
    setDraft({ ...karte })
    setDraftImages({ ...images })
    uploadedRef.current = []
    setFocusKey(key ?? null)
    setNotice('')
    setError('')
  }

  const cancelEdit = () => {
    const changed = JSON.stringify(draft) !== JSON.stringify(karte) || JSON.stringify(draftImages) !== JSON.stringify(images)
    if (changed && !confirm('編集中の内容を破棄してよいですか？')) return
    discardKarteImages(client.id, uploadedRef.current)
    uploadedRef.current = []
    setDraft(null)
    setDraftImages(images)
    setFocusKey(null)
    setNotice('')
    setError('')
    if (!hasContent(karte, images)) onClose()
  }

  const handleSave = async () => {
    if (!draft) return
    setIsSaving(true)
    setError('')
    try {
      // 空のセクションは保存しない
      const cleaned: Karte = {}
      for (const [k, v] of Object.entries(draft)) if (v.trim()) cleaned[k] = v.trim()
      const cleanedImages: KarteImages = {}
      for (const [k, paths] of Object.entries(draftImages)) if (paths.length) cleanedImages[k] = paths
      const at = await saveKarte(client.id, cleaned, cleanedImages)
      // 添付したあと外した画像は、保存が済んでから消す
      const kept = new Set(Object.values(cleanedImages).flat())
      discardKarteImages(client.id, uploadedRef.current.filter((p) => !kept.has(p)))
      uploadedRef.current = []
      setKarte(cleaned)
      setImages(cleanedImages)
      setDraftImages(cleanedImages)
      setUpdatedAt(at)
      setDraft(null)
      setNotice('')
      onSaved?.(cleaned, cleanedImages, at)
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

  const openAttach = (key: string) => {
    attachKeyRef.current = key
    attachRef.current?.click()
  }

  const handleAttach = async (files: FileList | null) => {
    const key = attachKeyRef.current
    if (!files || files.length === 0 || !key) return
    setError('')
    const current = draftImages[key] ?? []
    const room = MAX_ATTACH - current.length
    const picked = Array.from(files).slice(0, room)
    if (files.length > room) setError(`画像は1つの項目に${MAX_ATTACH}枚までです。最初の${room}枚だけ添付しました。`)
    setUploadingKey(key)
    try {
      const added: string[] = []
      for (const file of picked) {
        const path = await uploadKarteImage(client.id, await compressForAttachment(file))
        uploadedRef.current.push(path)
        added.push(path)
      }
      setDraftImages((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...added] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像の添付に失敗しました')
    } finally {
      setUploadingKey(null)
      if (attachRef.current) attachRef.current.value = ''
    }
  }

  const removeImage = (key: string, path: string) => {
    setDraftImages((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((p) => p !== path) }))
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
            disabled={isSaving || uploadingKey !== null}
            className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg font-bold disabled:opacity-50"
          >
            {isSaving ? '保存中…' : '保存'}
          </button>
        ) : (
          <button onClick={() => startEdit()} className="border border-gray-300 bg-white text-gray-700 text-sm px-4 py-2 rounded-lg font-medium">
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
          記入済みのヒアリングシートやメモの写真を選ぶと、内容を読み取って下の各項目に入れます（1回{MAX_IMAGES}枚まで）。読み取りに使った写真は保存されません。写真を残したいときは、各項目の「写真を添付」を使ってください。
        </p>

        {notice && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm px-4 py-3 rounded-xl">{notice}</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* 各項目への画像の添付 */}
        <input
          ref={attachRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleAttach(e.target.files)}
        />

        {sections.map((s) => {
          const value = (draft ? draft[s.key] : karte[s.key]) ?? ''
          const sectionImages = (draft ? draftImages[s.key] : images[s.key]) ?? []
          if (!draft) {
            return (
              <section key={s.key} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-emerald-700">{s.label}</h2>
                  <button type="button" onClick={() => startEdit(s.key)} className="text-sm text-gray-500 underline">
                    {value.trim() || sectionImages.length ? '編集' : '記入する'}
                  </button>
                </div>
                {value.trim() ? (
                  <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{value}</p>
                ) : (
                  !sectionImages.length && <p className="text-sm text-gray-400">未記入</p>
                )}
                {sectionImages.length > 0 && (
                  <div className={`grid grid-cols-2 gap-2 ${value.trim() ? 'mt-3' : ''}`}>
                    {sectionImages.map((path) => (
                      <button key={path} type="button" onClick={() => setViewing(path)} className="block">
                        <img
                          src={karteImageUrl(path)}
                          alt={`${s.label}の写真`}
                          loading="lazy"
                          className="w-full aspect-[4/3] object-cover rounded-xl bg-gray-100"
                        />
                      </button>
                    ))}
                  </div>
                )}
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
                autoFocus={focusKey === s.key}
              />
              {sectionImages.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {sectionImages.map((path) => (
                    <div key={path} className="relative">
                      <img
                        src={karteImageUrl(path)}
                        alt={`${s.label}の写真`}
                        className="w-full aspect-[4/3] object-cover rounded-xl bg-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(s.key, path)}
                        aria-label="この写真を外す"
                        className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {sectionImages.length < MAX_ATTACH && (
                <button
                  type="button"
                  onClick={() => openAttach(s.key)}
                  disabled={uploadingKey !== null}
                  className="mt-3 w-full border border-dashed border-gray-300 text-gray-600 py-3 rounded-xl text-sm disabled:opacity-50"
                >
                  {uploadingKey === s.key ? '写真を縮小して保存中…' : `写真を添付（あと${MAX_ATTACH - sectionImages.length}枚）`}
                </button>
              )}
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
              disabled={isSaving || uploadingKey !== null}
              className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl text-base font-bold shadow-md disabled:opacity-50"
            >
              {isSaving ? '保存中…' : '保存'}
            </button>
          </div>
        )}
      </div>

      {/* 添付画像の拡大表示 */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <img src={karteImageUrl(viewing)} alt="" className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="absolute top-4 right-4 bg-white/90 text-gray-800 text-sm px-4 py-2 rounded-lg font-bold"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}

// 内容の行数（折り返しを含む）に合わせて高さが伸びる記入欄
function AutoTextarea({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
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
      autoFocus={autoFocus}
      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-800 leading-relaxed bg-gray-50 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
  )
}
