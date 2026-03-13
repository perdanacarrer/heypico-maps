import { useState } from 'react'
import { Place } from '../types'
import { MapPin, Clock, ExternalLink, Globe, Navigation, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { osmDirectionsUrl, googleMapsDirectionsUrl, getUserLocation } from '../utils/api'

interface PlaceCardProps {
  place: Place
  index: number
}

export function PlaceCard({ place, index }: PlaceCardProps) {
  const { setSelectedPlace, setMapCenter, userLocation, setUserLocation } = useAppStore()
  const [loadingDir, setLoadingDir] = useState(false)

  const handleClick = () => {
    setSelectedPlace(place)
    setMapCenter({ lat: place.lat, lng: place.lng }, 16)
  }

  // Get user location then open directions
  const handleDirections = async (e: React.MouseEvent, provider: 'osm' | 'google') => {
    e.stopPropagation()
    setLoadingDir(true)

    let loc = userLocation
    if (!loc) {
      try {
        loc = await getUserLocation()
        setUserLocation(loc)
      } catch {
        // Permission denied or unavailable — open without origin
      }
    }

    setLoadingDir(false)

    const url = provider === 'osm'
      ? osmDirectionsUrl(place.lat, place.lng, place.name, loc?.lat, loc?.lng)
      : googleMapsDirectionsUrl(place.lat, place.lng, place.name, loc?.lat, loc?.lng)

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer bg-surface-2 hover:bg-surface-3 border border-white/5 hover:border-accent/30 rounded-xl p-3 transition-all duration-200 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        {/* Index badge */}
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
          <span className="text-accent text-xs font-mono font-semibold">{index + 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-white text-sm font-semibold font-display leading-tight">{place.name}</h4>

          {place.address && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-white/30 flex-shrink-0" />
              <p className="text-white/40 text-xs truncate">{place.address}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {place.cuisine && (
              <span className="text-xs text-accent/80 bg-accent/10 rounded-full px-2 py-0.5">
                🍽 {place.cuisine}
              </span>
            )}
            {place.type && (
              <span className="text-xs text-white/30 font-mono">{place.type.replace(/_/g, ' ')}</span>
            )}
          </div>

          {place.opening_hours && (
            <div className="flex items-center gap-1 mt-1.5">
              <Clock className="w-3 h-3 text-white/30" />
              <span className="text-white/40 text-xs truncate">{place.opening_hours}</span>
            </div>
          )}

          {/* Direction buttons — always visible */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <button
              onClick={(e) => handleDirections(e, 'osm')}
              disabled={loadingDir}
              className="flex items-center gap-1 text-accent text-xs hover:underline disabled:opacity-50"
            >
              {loadingDir
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Navigation className="w-3 h-3" />}
              Directions (OSM)
            </button>
            <span className="text-white/20">·</span>
            <button
              onClick={(e) => handleDirections(e, 'google')}
              disabled={loadingDir}
              className="flex items-center gap-1 text-accent-green text-xs hover:underline disabled:opacity-50"
            >
              <Navigation className="w-3 h-3" />
              Google Maps
            </button>
            {place.website && (
              <>
                <span className="text-white/20">·</span>
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-accent-amber text-xs hover:underline"
                >
                  <Globe className="w-3 h-3" /> Website
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
