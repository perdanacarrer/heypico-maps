import { create } from 'zustand'
import { AppState, Place, ChatMessage } from '../types'

const DEFAULT_CENTER = { lat: -6.2297, lng: 106.7634 }

interface ExtendedState extends AppState {
  userLocation: { lat: number; lng: number } | null
  setUserLocation: (loc: { lat: number; lng: number } | null) => void
}

export const useAppStore = create<ExtendedState>((set) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your AI local guide 🗺️ Ask me to find restaurants, cafes, attractions, hotels, or anything nearby.\n\nTry: *\"Find ramen restaurants in Jakarta\"* or *\"Coffee shops near Senayan\"*",
      timestamp: new Date(),
      places: [],
    }
  ],
  selectedPlace: null,
  mapCenter: DEFAULT_CENTER,
  mapZoom: 12,
  isLoading: false,
  highlightedPlaces: [],
  userLocation: null,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setSelectedPlace: (place) => set({ selectedPlace: place }),
  setMapCenter: (center, zoom) =>
    set({ mapCenter: center, ...(zoom !== undefined && { mapZoom: zoom }) }),
  setLoading: (v) => set({ isLoading: v }),
  setHighlightedPlaces: (places) => set({ highlightedPlaces: places }),
  setUserLocation: (loc) => set({ userLocation: loc }),
}))
