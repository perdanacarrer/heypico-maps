import axios from 'axios'
import { ChatResponse } from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

export async function sendChat(
  message: string,
  history: { role: string; content: string }[]
): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/chat', {
    message,
    conversation_history: history,
  })
  return data
}

export async function getMapsKey(): Promise<string> {
  const { data } = await api.get<{ key: string }>('/maps-key')
  return data.key
}

export async function getPlaceDetails(placeId: string) {
  const { data } = await api.get(`/place/${placeId}`)
  return data
}

export function getPhotoUrl(photoRef: string, maxWidth = 400): string {
  return `/api/photo?photo_reference=${photoRef}&maxwidth=${maxWidth}`
}
