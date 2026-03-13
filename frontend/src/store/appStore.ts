import { create } from 'zustand'
import { AppState, Place, ChatMessage } from '../types'

// Default center: South Tangerang / Jakarta
const DEFAULT_CENTER = { lat: -6.2297, lng: 106.7634 }

export const useAppStore = create<AppState>((set) => ({
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

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setSelectedPlace: (place) => set({ selectedPlace: place }),
  setMapCenter: (center, zoom) =>
    set({ mapCenter: center, ...(zoom !== undefined && { mapZoom: zoom }) }),
  setLoading: (v) => set({ isLoading: v }),
  setHighlightedPlaces: (places) => set({ highlightedPlaces: places }),
}))
