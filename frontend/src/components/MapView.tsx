import { useRef, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useGoogleMap } from '../hooks/useGoogleMap'
import { MapPin, AlertCircle } from 'lucide-react'

export function MapView() {
  const { mapCenter, mapZoom, highlightedPlaces, setSelectedPlace } = useAppStore()
  const mapRef = useRef<HTMLDivElement>(null)
  const { mapReady, error, placeMarkers, clearMarkers } = useGoogleMap(mapRef, mapCenter, mapZoom)

  useEffect(() => {
    if (!mapReady) return
    if (highlightedPlaces.length > 0) {
      placeMarkers(highlightedPlaces, setSelectedPlace)
    } else {
      clearMarkers()
    }
  }, [mapReady, highlightedPlaces])

  return (
    <div className="relative w-full h-full bg-surface-1 rounded-2xl overflow-hidden border border-white/5">
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!mapReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1">
          <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
          <p className="text-white/50 text-sm font-mono">Loading map...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1 p-6">
          <AlertCircle className="w-12 h-12 text-accent-warm mb-4" />
          <p className="text-white/70 text-sm text-center font-sans">{error}</p>
          <p className="text-white/30 text-xs text-center mt-2">
            Make sure GOOGLE_MAPS_API_KEY is set in your .env file
          </p>
        </div>
      )}

      {/* Place count badge */}
      {mapReady && highlightedPlaces.length > 0 && (
        <div className="absolute top-4 left-4 bg-surface-2/90 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-accent" />
          <span className="text-white/70 text-xs font-mono">
            {highlightedPlaces.length} places found
          </span>
        </div>
      )}
    </div>
  )
}
