import { getSupabase } from './supabase'
import type { Client, Pet, PetType } from '@/types'

// ─── 顧客・ペット取得 ─────────────────────────────────────
export async function getClients(): Promise<Client[]> {
  const { data, error } = await getSupabase()
    .from('clients')
    .select('id, name, report_example, pets(id, name, type, notes)')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    reportExample: (row.report_example as string) ?? '',
    pets: (row.pets as Client['pets']) ?? [],
  }))
}

// ─── 顧客 CRUD ────────────────────────────────────────────
export async function addClient(name: string, reportExample?: string): Promise<Client> {
  const { data, error } = await getSupabase()
    .from('clients')
    .insert({ name, report_example: reportExample ?? '' })
    .select()
    .single()
  if (error) throw error
  const row = data as Record<string, unknown>
  return { id: row.id as string, name: row.name as string, reportExample: (row.report_example as string) ?? '', pets: [] }
}

export async function updateClient(id: string, name: string, reportExample?: string): Promise<void> {
  const { error } = await getSupabase().from('clients').update({ name, report_example: reportExample ?? '' }).eq('id', id)
  if (error) throw error
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await getSupabase().from('clients').delete().eq('id', id)
  if (error) throw error
}

// ─── ペット CRUD ──────────────────────────────────────────
export async function addPet(clientId: string, name: string, type: PetType, notes: string): Promise<Pet> {
  const { data, error } = await getSupabase()
    .from('pets')
    .insert({ client_id: clientId, name, type, notes })
    .select()
    .single()
  if (error) throw error
  return data as Pet
}

export async function updatePet(id: string, name: string, type: PetType, notes: string): Promise<void> {
  const { error } = await getSupabase().from('pets').update({ name, type, notes }).eq('id', id)
  if (error) throw error
}

export async function deletePet(id: string): Promise<void> {
  const { error } = await getSupabase().from('pets').delete().eq('id', id)
  if (error) throw error
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
