'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Client } from '@/types'
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
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [startDatetime, setStartDatetime] = useState(getDefaultStartDatetime)
  const [endTime, setEndTime] = useState(() => getDefaultEndTime(getDefaultStartDatetime()))
  const [fields, setFields] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    setSpeechSupported(!!SR)
  }, [])

  useEffect(() => { setFields({}) }, [selectedClientId])

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
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return }

    recognitionRef.current?.abort()
    const rec = new SR()
    rec.lang = 'ja-JP'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const t = e.results[i][0].transcript
          setFields((prev) => ({ ...prev, notes: prev.notes ? prev.notes + '\n' + t : t }))
        }
      }
    }
    rec.onend = () => { if (isRecording) { try { rec.start() } catch (_) {} } }
    rec.onerror = () => setIsRecording(false)
    recognitionRef.current = rec
    rec.start()
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

  const inputClass = 'w-full min-w-0 border border-gray-300 rounded-xl px-4 py-4 text-base text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500'
  const sectionClass = 'bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4'
  const sectionTitle = 'text-sm font-bold text-gray-700'

  const hasNextVisit = !!(fields.nextStart || fields.nextEnd)

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-800 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-bold text-gray-700">報告書を作成</span>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-10 overflow-x-hidden">

        {/* 顧客選択 */}
        <section className={sectionClass}>
          <h2 className={sectionTitle}>お客様・ペット</h2>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className={inputClass}
          >
            <option value="">お客様を選択してください</option>
            {clients.filter((c) => c.pets.length > 0).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {pets.length > 0 && (
            <p className="text-sm text-gray-600">
              対象ペット：{pets.map((p) => `${p.type === 'dog' ? '🐶' : '🐱'} ${p.name}`).join('　')}
            </p>
          )}
        </section>

        {/* 訪問日時 */}
        <section className={sectionClass}>
          <h2 className={sectionTitle}>訪問日時</h2>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">開始</label>
            <input
              type="datetime-local"
              step={300}
              value={startDatetime}
              onChange={(e) => { setStartDatetime(e.target.value); setEndTime(getDefaultEndTime(e.target.value)) }}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">終了時刻</label>
            <input
              type="time"
              step={300}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </section>

        {/* 基本確認 */}
        {pets.length > 0 && <BasicCheck hasDog={hasDog} hasCat={hasCat} />}

        {/* お世話の様子 */}
        {pets.length > 0 && (
          <section className={sectionClass}>
            <h2 className={sectionTitle}>お世話の様子</h2>
            <p className="text-sm text-gray-600">散歩・ペットの状態・気になることなど自由に</p>
            <textarea
              value={fields.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              rows={9}
              placeholder="例：今日は雨だったのでカッパを着用しました。四中の裏の道を散歩して…"
              className={`w-full border rounded-xl px-4 py-4 text-base text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-colors ${
                isRecording ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50'
              }`}
            />
            <button
              onClick={toggleVoice}
              disabled={!speechSupported}
              className={`w-full py-5 rounded-2xl text-base font-bold flex items-center justify-center gap-3 shadow-md transition-all ${
                isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-600 text-white active:bg-emerald-700'
              } disabled:opacity-40`}
            >
              {isRecording ? (
                <><span className="w-3 h-3 rounded-full bg-white inline-block" />録音中… もう一度押すと停止</>
              ) : (
                <><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.42 2.72 6.23 6 6.72V21h2v-2.28c3.28-.49 6-3.3 6-6.72h-1.7z" />
                </svg>押して話す</>
              )}
            </button>
            {!speechSupported && <p className="text-sm text-center text-gray-500">音声入力は Safari で利用可能</p>}
          </section>
        )}

        {/* 退出確認 */}
        {pets.length > 0 && (
          <section className={sectionClass}>
            <h2 className={sectionTitle}>退出</h2>

            {/* 施錠 */}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={fields.locked === 'true'}
                onChange={(e) => setField('locked', e.target.checked ? 'true' : '')}
                className="w-6 h-6 rounded accent-emerald-600"
              />
              <span className="text-base font-medium text-gray-700">施錠・退出済み</span>
            </label>

            {/* 鍵の返却 */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">🔑 鍵の返却</p>
              <div className="flex gap-2">
                {(['あり', 'なし'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField('keyReturn', fields.keyReturn === opt ? '' : opt)}
                    className={`px-5 py-2 rounded-full text-sm border font-medium transition-colors select-none ${
                      fields.keyReturn === opt
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-gray-300 text-gray-600 bg-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* 次回訪問 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-600">次回訪問予定（任意）</label>
                {hasNextVisit && (
                  <button
                    type="button"
                    onClick={() => { setField('nextStart', ''); setField('nextEnd', '') }}
                    className="text-sm text-gray-400 underline"
                  >
                    クリア
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">日付・開始</label>
                  <input
                    type="datetime-local"
                    step={300}
                    value={fields.nextStart ?? ''}
                    onChange={(e) => setField('nextStart', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">終了時刻（任意）</label>
                  <input
                    type="time"
                    step={300}
                    value={fields.nextEnd ?? ''}
                    onChange={(e) => setField('nextEnd', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {pets.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-emerald-600 text-white py-5 rounded-2xl text-base font-bold shadow-md active:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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

function BasicCheck({ hasDog, hasCat }: { hasDog: boolean; hasCat: boolean }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-5">
      <h2 className="text-sm font-bold text-gray-700">基本確認</h2>

      <div>
        <p className="text-base font-medium text-gray-700 mb-3">🟡 オシッコ</p>
        <Counter id="pee" />
        <StatusButtons id="pee-status" options={['普通', '多い', '少ない']} color="blue" />
      </div>

      <div>
        <p className="text-base font-medium text-gray-700 mb-3">🟤 ウンチ</p>
        <Counter id="poop" />
        <StatusButtons id="poop-status" options={['普通', '柔らかい', '硬い', '多い', '少ない']} color="amber" />
      </div>

      <SoilingCheck />

      <div className="flex flex-wrap gap-4 pt-3 border-t border-gray-100">
        {hasDog && <CheckItem id="chk-water-dog" label="💧 お水飲んだ" />}
        {hasCat && (
          <>
            <CheckItem id="chk-toilet" label="🧹 トイレ掃除済み" />
            <CheckItem id="chk-water-cat" label="💧 お水を交換" />
          </>
        )}
        <CheckItem id="chk-feed-refill" label="🍚 ゴハン補充" />
        <CheckItem id="chk-feed-replace" label="🍚 ゴハン交換" />
        <CheckItem id="chk-brushing" label="🪮 ブラッシング" />
        <CheckItem id="chk-play" label="🎾 遊び" />
      </div>
    </section>
  )
}

function Counter({ id }: { id: string }) {
  const [count, setCount] = useState(0)
  return (
    <div className="flex items-center gap-3 mb-3">
      <button onClick={() => setCount((c) => Math.max(0, c - 1))}
        className="w-11 h-11 rounded-full bg-gray-100 text-gray-700 text-2xl font-medium flex items-center justify-center active:bg-gray-200 select-none">−</button>
      <span className="text-2xl font-bold text-gray-900 w-10 text-center tabular-nums">{count}</span>
      <button onClick={() => setCount((c) => c + 1)}
        className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 text-2xl font-medium flex items-center justify-center active:bg-emerald-100 select-none">＋</button>
      <span className="text-sm text-gray-500">回</span>
      <input type="hidden" id={id} value={count} />
    </div>
  )
}

function StatusButtons({ id, options, color }: { id: string; options: string[]; color: 'blue' | 'amber' }) {
  const [selected, setSelected] = useState<string | null>(null)
  const activeClass = color === 'amber' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-blue-500 border-blue-500 text-white'
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o}
          onClick={() => setSelected(selected === o ? null : o)}
          className={`px-4 py-2 rounded-full text-sm border transition-colors select-none font-medium ${
            selected === o ? activeClass : 'border-gray-300 text-gray-600 bg-white'
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
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" id="chk-soiling" checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="w-6 h-6 rounded accent-red-500" />
        <span className="text-base font-medium text-gray-700">⚠️ 粗相があった</span>
      </label>
      {checked && (
        <input type="text" id="soiling-place" placeholder="場所（例：玄関マット）"
          className="mt-3 w-full border border-gray-300 rounded-xl px-4 py-4 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      )}
    </div>
  )
}

function CheckItem({ id, label }: { id: string; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" id={id} className="w-6 h-6 rounded accent-emerald-600" />
      <span className="text-base text-gray-700">{label}</span>
    </label>
  )
}
