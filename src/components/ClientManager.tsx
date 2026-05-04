'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Client, Pet, PetType } from '@/types'
import {
  getClients,
  addClient,
  updateClient,
  deleteClient,
  addPet,
  updatePet,
  deletePet,
} from '@/lib/storage'

interface Props {
  onBack: () => void
}

export default function ClientManager({ onBack }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingPet, setEditingPet] = useState<{ clientId: string; pet: Pet } | null>(null)
  const [showPetForm, setShowPetForm] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try { setClients(await getClients()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleSaveClient = async (name: string) => {
    if (!name.trim()) return
    if (editingClient) {
      await updateClient(editingClient.id, name)
    } else {
      await addClient(name)
    }
    setEditingClient(null)
    setShowClientForm(false)
    reload()
  }

  const handleDeleteClient = async (id: string) => {
    if (!confirm('この顧客を削除してよいですか？')) return
    await deleteClient(id)
    reload()
  }

  const handleSavePet = async (clientId: string, name: string, type: PetType, notes: string) => {
    if (!name.trim()) return
    if (editingPet && editingPet.clientId === clientId) {
      await updatePet(editingPet.pet.id, name, type, notes)
    } else {
      await addPet(clientId, name, type, notes)
    }
    setEditingPet(null)
    setShowPetForm(null)
    reload()
  }

  const handleDeletePet = async (petId: string) => {
    if (!confirm('このペットを削除してよいですか？')) return
    await deletePet(petId)
    reload()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img src="/logo.svg" alt="ハピフリ" className="h-8" />
        <h1 className="text-base font-bold text-gray-700 flex-1">顧客・ペット管理</h1>
        <button
          onClick={() => { setEditingClient(null); setShowClientForm(true) }}
          className="bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
        >
          ＋ 顧客追加
        </button>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-8">
        {loading && (
          <p className="text-center text-gray-400 py-12 text-sm">読み込み中…</p>
        )}
        {!loading && clients.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">まだ顧客が登録されていません</p>
        )}

        {clients.map((client) => (
          <div key={client.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-gray-900">{client.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingClient(client); setShowClientForm(true) }}
                  className="text-xs text-blue-600 px-2 py-1 rounded border border-blue-200"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDeleteClient(client.id)}
                  className="text-xs text-red-500 px-2 py-1 rounded border border-red-200"
                >
                  削除
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 px-4 pb-3">
              {client.pets.map((pet) => (
                <div key={pet.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">
                    {pet.type === 'dog' ? '🐶' : '🐱'} {pet.name}
                    {pet.notes && <span className="text-gray-400"> — {pet.notes}</span>}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingPet({ clientId: client.id, pet }); setShowPetForm(client.id) }}
                      className="text-xs text-blue-600 px-2 py-0.5 rounded border border-blue-200"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeletePet(pet.id)}
                      className="text-xs text-red-500 px-2 py-0.5 rounded border border-red-200"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => { setEditingPet(null); setShowPetForm(client.id) }}
                className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1"
              >
                ＋ ペットを追加
              </button>
            </div>
          </div>
        ))}
      </div>

      {showClientForm && (
        <FormModal
          title={editingClient ? '顧客を編集' : '顧客を追加'}
          onClose={() => { setShowClientForm(false); setEditingClient(null) }}
        >
          <ClientForm
            initial={editingClient?.name ?? ''}
            onSave={handleSaveClient}
            onCancel={() => { setShowClientForm(false); setEditingClient(null) }}
          />
        </FormModal>
      )}

      {showPetForm && (
        <FormModal
          title={editingPet ? 'ペットを編集' : 'ペットを追加'}
          onClose={() => { setShowPetForm(null); setEditingPet(null) }}
        >
          <PetForm
            initial={editingPet?.pet}
            onSave={(name, type, notes) => handleSavePet(showPetForm, name, type, notes)}
            onCancel={() => { setShowPetForm(null); setEditingPet(null) }}
          />
        </FormModal>
      )}
    </div>
  )
}

function FormModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ClientForm({ initial, onSave, onCancel }: { initial: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial)
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">お客様名</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：田中様"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          onKeyDown={(e) => e.key === 'Enter' && onSave(name)}
        />
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium">キャンセル</button>
        <button onClick={() => onSave(name)} disabled={!name.trim()} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">保存</button>
      </div>
    </div>
  )
}

function PetForm({ initial, onSave, onCancel }: { initial?: Pet; onSave: (name: string, type: PetType, notes: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<PetType>(initial?.type ?? 'dog')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ペット名</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：マーキス"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">種類</label>
        <div className="flex gap-3">
          {(['dog', 'cat'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${type === t ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 text-gray-700'}`}
            >
              {t === 'dog' ? '🐶 犬' : '🐱 猫'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">メモ（任意）</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="例：臆病、カッパあり"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium">キャンセル</button>
        <button onClick={() => onSave(name, type, notes)} disabled={!name.trim()} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">保存</button>
      </div>
    </div>
  )
}
