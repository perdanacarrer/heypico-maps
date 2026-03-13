import axios from 'axios'
import { ChatResponse } from '../types'

const api = axios.create({ baseURL: '/api', timeout: 90000 })

export async function sendChat(message: string, history: { role: string; content: string }[]): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/chat', { message, conversation_history: history })
  return data
}

/**
 * OSM Directions URL — includes user's current location as "from" if available.
 * Falls back to just the destination if geolocation is denied.
 */
export function osmDirectionsUrl(
  toLat: number,
  toLng: number,
  toName: string,
  userLat?: number,
  userLng?: number
): string {
  const dest = `${toLat}%2C${toLng}`
  const destName = encodeURIComponent(toName)

  if (userLat !== undefined && userLng !== undefined) {
    const from = `${userLat}%2C${userLng}`
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from}%3B${dest}#map=14/${toLat}/${toLng}`
  }

  // No user location — open directions with only destination filled
  return `https://www.openstreetmap.org/directions?to=${dest}&to_name=${destName}`
}

/**
 * Google Maps directions — works with or without user location.
 */
export function googleMapsDirectionsUrl(
  toLat: number,
  toLng: number,
  toName: string,
  userLat?: number,
  userLng?: number
): string {
  const dest = encodeURIComponent(`${toLat},${toLng}`)
  if (userLat !== undefined && userLng !== undefined) {
    const origin = encodeURIComponent(`${userLat},${userLng}`)
    return `https://www.google.com/maps/dir/${origin}/${dest}/`
  }
  return `https://www.google.com/maps/dir//${dest}/`
}

export function googleMapsUrl(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/**
 * Get user's GPS location via browser Geolocation API.
 */
export function getUserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, maximumAge: 60000 }
    )
  })
}
