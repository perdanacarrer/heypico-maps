import { Place } from '../types'
import { MapPin, Clock, ExternalLink, Globe, Phone } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { osmDirectionsUrl, googleMapsUrl } from '../utils/api'

interface PlaceCardProps {
  place: Place
  index: number
}

export function PlaceCard({ place, index }: PlaceCardProps) {
  const { setSelectedPlace, setMapCenter } = useAppStore()

  const handleClick = () => {
    setSelectedPlace(place)
    setMapCenter({ lat: place.lat, lng: place.lng }, 16)
  }

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer bg-surface-2 hover:bg-surface-3 border border-white/5 hover:border-accent/30 rounded-xl p-3 transition-all duration-200 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        {/* Index */}
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

          {/* Links - visible on hover */}
          <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
            <a
              href={osmDirectionsUrl(place.lat, place.lng, place.name)}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-accent text-xs hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Directions
            </a>
            <a
              href={googleMapsUrl(place.lat, place.lng, place.name)}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-accent-green text-xs hover:underline"
            >
              Google Maps
            </a>
            {place.website && (
              <a
                href={place.website}
                target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-accent-amber text-xs hover:underline flex items-center gap-1"
              >
                <Globe className="w-3 h-3" /> Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
