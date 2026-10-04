import type { Client, Karte, KarteImages, Pet, PetType } from '@/types'

// データの読み書きはすべて自前のAPI経由（ブラウザから Supabase には直接つながない）
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    // FormData（画像）のときはブラウザに Content-Type を任せる
    headers: typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('ログインが必要です')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '通信に失敗しました')
  return data as T
}

// ─── 顧客・ペット取得 ─────────────────────────────────────
export function getClients(): Promise<Client[]> {
  return api<Client[]>('/api/clients')
}

// ─── 顧客 CRUD ────────────────────────────────────────────
export function addClient(name: string, reportExample?: string, furigana?: string): Promise<Client> {
  return api<Client>('/api/clients', { method: 'POST', body: JSON.stringify({ name, reportExample, furigana }) })
}

export async function updateClient(id: string, name: string, reportExample?: string, furigana?: string): Promise<void> {
  await api(`/api/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, reportExample: reportExample ?? '', furigana: furigana ?? '' }),
  })
}

export async function deleteClient(id: string): Promise<void> {
  await api(`/api/clients/${id}`, { method: 'DELETE' })
}

// ─── カルテ ───────────────────────────────────────────────
export async function saveKarte(clientId: string, karte: Karte, karteImages: KarteImages): Promise<string | null> {
  const res = await api<{ karteUpdatedAt: string | null }>(`/api/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify({ karte, karteImages }),
  })
  return res.karteUpdatedAt
}

// ─── カルテの添付画像 ─────────────────────────────────────
export async function uploadKarteImage(clientId: string, image: Blob): Promise<string> {
  const form = new FormData()
  form.append('clientId', clientId)
  form.append('file', image)
  const res = await api<{ path: string }>('/api/karte/images', { method: 'POST', body: form })
  return res.path
}

// カルテに保存しなかった画像を消す（失敗しても画面の操作は止めない）
export function discardKarteImages(clientId: string, paths: string[]): void {
  if (paths.length === 0) return
  api('/api/karte/images', { method: 'DELETE', body: JSON.stringify({ clientId, paths }) }).catch(() => {})
}

export function karteImageUrl(path: string): string {
  return `/api/karte/images?path=${encodeURIComponent(path)}`
}

export async function extractKarte(images: string[], petTypes: PetType[]): Promise<Karte> {
  const res = await api<{ karte: Karte }>('/api/karte/extract', {
    method: 'POST',
    body: JSON.stringify({ images, petTypes }),
  })
  return res.karte
}

// ─── ペット CRUD ──────────────────────────────────────────
export function addPet(clientId: string, name: string, type: PetType, notes: string): Promise<Pet> {
  return api<Pet>('/api/pets', { method: 'POST', body: JSON.stringify({ clientId, name, type, notes }) })
}

export async function updatePet(id: string, name: string, type: PetType, notes: string): Promise<void> {
  await api(`/api/pets/${id}`, { method: 'PATCH', body: JSON.stringify({ name, type, notes }) })
}

export async function deletePet(id: string): Promise<void> {
  await api(`/api/pets/${id}`, { method: 'DELETE' })
}

// ─── 日時ユーティリティ ───────────────────────────────────
export function formatVisitDateTime(startDatetime: string, endTime: string): string {
  const d = new Date(startDatetime)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const month = d.getMonth() + 1
  const date = d.getDate()
  const day = days[d.getDay()]
  const startH = d.getHours().toString().padStart(2, '0')
  const startM = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${date}（${day}）${startH}:${startM}-${endTime}`
}

export function getDefaultStartDatetime(): string {
  const now = new Date()
  const m = Math.ceil(now.getMinutes() / 5) * 5
  now.setMinutes(m >= 60 ? 0 : m, 0, 0)
  if (m >= 60) now.setHours(now.getHours() + 1)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function getDefaultEndTime(startDatetime: string): string {
  const start = new Date(startDatetime)
  start.setHours(start.getHours() + 1)
  return `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`
}
