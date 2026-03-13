import axios from 'axios'
import { ChatResponse } from '../types'

const api = axios.create({ baseURL: '/api', timeout: 90000 })

export async function sendChat(message: string, history: { role: string; content: string }[]): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/chat', { message, conversation_history: history })
  return data
}

export function osmDirectionsUrl(lat: number, lng: number, name: string): string {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}&to_name=${encodeURIComponent(name)}`
}

export function osmViewUrl(osmType: string, osmId: number): string {
  return `https://www.openstreetmap.org/${osmType}/${osmId}`
}

export function googleMapsUrl(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(name)}`
}
