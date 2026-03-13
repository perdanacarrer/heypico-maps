import { create } from 'zustand'
import { AppState, Place, ChatMessage } from '../types'

// Default center: Jakarta (since user is in South Tangerang)
const DEFAULT_CENTER = { lat: -6.2088, lng: 106.8456 }

export const useAppStore = create<AppState>((set) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your AI local guide 🗺️ Ask me to find restaurants, cafes, attractions, hotels, or anything else nearby. Try: *\"Find me the best ramen near Senayan\"*",
      timestamp: new Date(),
      places: [],
    }
  ],
  selectedPlace: null,
  mapCenter: DEFAULT_CENTER,
  mapZoom: 12,
  isLoading: false,
  highlightedPlaces: [],

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setSelectedPlace: (place) =>
    set({ selectedPlace: place }),

  setMapCenter: (center, zoom) =>
    set({ mapCenter: center, ...(zoom !== undefined && { mapZoom: zoom }) }),

  setLoading: (v) => set({ isLoading: v }),

  setHighlightedPlaces: (places) => set({ highlightedPlaces: places }),
}))
