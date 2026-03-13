export interface Place {
  place_id: string
  osm_id?: number
  osm_type?: string
  name: string
  address: string
  lat: number
  lng: number
  type?: string
  category?: string
  website?: string
  phone?: string
  opening_hours?: string
  cuisine?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  places?: Place[]
  mapCenter?: { lat: number; lng: number }
  searchQuery?: string
}

export interface ChatResponse {
  user_message: string
  intent: 'place_search' | 'general'
  places: Place[]
  map_center: { lat: number; lng: number } | null
  search_query: string | null
}

export interface AppState {
  messages: ChatMessage[]
  selectedPlace: Place | null
  mapCenter: { lat: number; lng: number }
  mapZoom: number
  isLoading: boolean
  highlightedPlaces: Place[]
  addMessage: (msg: ChatMessage) => void
  setSelectedPlace: (place: Place | null) => void
  setMapCenter: (center: { lat: number; lng: number }, zoom?: number) => void
  setLoading: (v: boolean) => void
  setHighlightedPlaces: (places: Place[]) => void
}
