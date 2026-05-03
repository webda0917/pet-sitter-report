'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Client } from '@/types'
import { DOG_FIELD_DEFS, CAT_FIELD_DEFS } from '@/types'
import {
  formatVisitDateTime,
  getDefaultStartDatetime,
  getDefaultEndTime,
} from '@/lib/storage'

interface Props {
  clients: Client[]
  onGenerate: (report: string) => void
  onBack: () => void
}

export default function ReportForm({ clients, onGenerate, onBack }: Props) {
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id ?? '')
  const [startDatetime, setStartDatetime] = useState(getDefaultStartDatetime)
  const [endTime, setEndTime] = useState(() => getDefaultEndTime(getDefaultStartDatetime()))
  const [fields, setFields] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  // Voice input
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    setSpeechSupported(!!SR)
  }, [])

  // Reset fields when client changes
  useEffect(() => {
    setFields({})
  }, [selectedClientId])

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const pets = selectedClient?.pets ?? []
  const hasDog = pets.some((p) => p.type === 'dog')
  const hasCat = pets.some((p) => p.type === 'cat')

  const setField = useCallback((key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }, [])

  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return

    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }

    recognitionRef.current?.abort()
    const recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const t = event.results[i][0].transcript
          setFields((prev) => ({
            ...prev,
            notes: prev.notes ? prev.notes + '\n' + t : t,
          }))
        }
      }
    }
    recognition.onend = () => {
      if (isRecording) { try { recognition.start() } catch (_) {} }
    }
    recognition.onerror = () => setIsRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [isRecording])

  const handleGenerate = async () => {
    if (!selectedClient || pets.length === 0) return
    setIsGenerating(true)
    setError('')

    try {
      const visitDateTime = formatVisitDateTime(startDatetime, endTime)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pets: pets.map((p) => ({ name: p.name, type: p.type })),
          visitDateTime,
          fields,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '生成に失敗しました')
      onGenerate(data.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">報告書を作成</h1>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-8">

        {/* 顧客選択 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">お客様・ペット</h2>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            {clients.filter((c) => c.pets.length > 0).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {pets.length > 0 && (
            <p className="text-xs text-gray-400">
              対象ペット：{pets.map((p) => `${p.type === 'dog' ? '🐶' : '🐱'} ${p.name}`).join('　')}
            </p>
          )}
        </section>

        {/* 訪問日時 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">訪問日時</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">開始</label>
              <input type="datetime-local" value={startDatetime}
                onChange={(e) => { setStartDatetime(e.target.value); setEndTime(getDefaultEndTime(e.target.value)) }}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">終了時刻</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </section>

        {/* 基本確認 */}
        {pets.length > 0 && (
          <BasicCheck hasDog={hasDog} hasCat={hasCat} />
        )}

        {/* お世話の様子（メイン） */}
        {pets.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">お世話の様子</h2>
            <p className="text-xs text-gray-400">散歩の様子、ペットの状態、気になることなど自由に</p>
            <textarea
              value={fields.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              rows={9}
              placeholder="例：今日は雨だったのでカッパを着用しました。四中の裏の道を散歩して…"
              className={`w-full border rounded-xl px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-colors ${
                isRecording ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
            />
            <button
              onClick={toggleVoice}
              disabled={!speechSupported}
              className={`w-full py-5 rounded-2xl text-base font-bold flex items-center justify-center gap-3 shadow-md transition-all ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-600 text-white active:bg-emerald-700'
              } disabled:opacity-40`}
            >
              {isRecording ? (
                <><span className="w-3 h-3 rounded-full bg-white inline-block" />録音中… もう一度押すと停止</>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.42 2.72 6.23 6 6.72V21h2v-2.28c3.28-.49 6-3.3 6-6.72h-1.7z" />
                  </svg>
                  押して話す
                </>
              )}
            </button>
            {!speechSupported && <p className="text-xs text-center text-gray-300">音声入力は Safari で利用可能</p>}
          </section>
        )}

        {/* 退出確認 */}
        {pets.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">退出</h2>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={fields.locked === 'true'}
                onChange={(e) => setField('locked', e.target.checked ? 'true' : '')}
                className="w-6 h-6 rounded accent-emerald-600"
              />
              <span className="text-sm font-medium text-gray-700">施錠・退出済み</span>
            </label>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">次回訪問予定（任意）</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">日付・開始</label>
                  <input type="datetime-local" value={fields.nextStart ?? ''}
                    onChange={(e) => setField('nextStart', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">終了時刻</label>
                  <input type="time" value={fields.nextEnd ?? ''}
                    onChange={(e) => setField('nextEnd', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {pets.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-emerald-600 text-white py-4 rounded-xl text-base font-bold shadow-md active:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>AI が報告文を生成中…</>
            ) : (
              <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>AIで報告文を生成</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// 基本確認コンポーネント（犬・猫・混在に対応）
function BasicCheck({ hasDog, hasCat }: { hasDog: boolean; hasCat: boolean }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">基本確認</h2>

      {/* オシッコ */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">🟡 オシッコ</p>
        <Counter id="pee" />
        <StatusButtons id="pee-status" options={['普通','多い','少ない']} color="blue" />
      </div>

      {/* ウンチ */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">🟤 ウンチ</p>
        <Counter id="poop" />
        <StatusButtons id="poop-status" options={['普通','柔らかい','硬い','多い','少ない']} color="amber" />
      </div>

      {/* 粗相 */}
      <SoilingCheck />

      {/* その他チェック */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100">
        {hasDog && (
          <>
            <CheckItem id="chk-feed" label="🍚 ゴハン食べた" />
            <CheckItem id="chk-water-dog" label="💧 お水飲んだ" />
          </>
        )}
        {hasCat && (
          <>
            <CheckItem id="chk-toilet" label="🧹 トイレ掃除済み" />
            <CheckItem id="chk-water-cat" label="💧 お水を交換" />
            <CheckItem id="chk-food" label="🍚 ゴハンを補充" />
          </>
        )}
      </div>
    </section>
  )
}

function Counter({ id }: { id: string }) {
  const [count, setCount] = useState(0)
  return (
    <div className="flex items-center gap-3 mb-2">
      <button onClick={() => setCount((c) => Math.max(0, c - 1))}
        className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-xl font-medium flex items-center justify-center active:bg-gray-200 select-none">−</button>
      <span className="text-xl font-bold text-gray-900 w-8 text-center tabular-nums">{count}</span>
      <button onClick={() => setCount((c) => c + 1)}
        className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 text-xl font-medium flex items-center justify-center active:bg-emerald-100 select-none">＋</button>
      <span className="text-sm text-gray-400">回</span>
      <input type="hidden" id={id} value={count} />
    </div>
  )
}

function StatusButtons({ id, options, color }: { id: string; options: string[]; color: 'blue' | 'amber' }) {
  const [selected, setSelected] = useState<string | null>(null)
  const activeClass = color === 'amber'
    ? 'bg-amber-600 border-amber-600 text-white'
    : 'bg-blue-500 border-blue-500 text-white'
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} id={`${id}-${o}`}
          onClick={() => setSelected(selected === o ? null : o)}
          className={`px-3 py-1.5 rounded-full text-xs border transition-colors select-none ${
            selected === o ? activeClass : 'border-gray-300 text-gray-600'
          }`}
        >
          {o}
        </button>
      ))}
      <input type="hidden" id={id} value={selected ?? ''} />
    </div>
  )
}

function SoilingCheck() {
  const [checked, setChecked] = useState(false)
  return (
    <div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" id="chk-soiling" checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="w-6 h-6 rounded accent-red-500" />
        <span className="text-sm font-medium text-gray-700">⚠️ 粗相があった</span>
      </label>
      {checked && (
        <input type="text" id="soiling-place" placeholder="場所（例：玄関マット）"
          className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      )}
    </div>
  )
}

function CheckItem({ id, label }: { id: string; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <input type="checkbox" id={id} className="w-6 h-6 rounded accent-emerald-600" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}
