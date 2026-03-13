import { Place } from '../types'
import { Star, MapPin, Clock, ExternalLink, DollarSign } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface PlaceCardProps {
  place: Place
  index: number
}

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$']

export function PlaceCard({ place, index }: PlaceCardProps) {
  const { setSelectedPlace, setMapCenter } = useAppStore()

  const handleClick = () => {
    setSelectedPlace(place)
    setMapCenter({ lat: place.lat, lng: place.lng }, 16)
  }

  const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination_place_id=${place.place_id}`

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
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-white text-sm font-semibold font-display leading-tight truncate">
              {place.name}
            </h4>
            {place.price_level && (
              <span className="text-accent-amber text-xs font-mono flex-shrink-0">
                {PRICE_LABELS[place.price_level]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-white/30 flex-shrink-0" />
            <p className="text-white/40 text-xs truncate">{place.address}</p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            {place.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-accent-amber fill-accent-amber" />
                <span className="text-white/70 text-xs font-mono">{place.rating}</span>
                {place.user_ratings_total && (
                  <span className="text-white/30 text-xs">({place.user_ratings_total.toLocaleString()})</span>
                )}
              </div>
            )}
            {place.open_now !== undefined && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-white/30" />
                <span className={`text-xs ${place.open_now ? 'text-accent-green' : 'text-accent-warm'}`}>
                  {place.open_now ? 'Open' : 'Closed'}
                </span>
              </div>
            )}
          </div>

          {/* Action links */}
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-accent text-xs hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </a>
            <span className="text-white/20">·</span>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-accent-amber text-xs hover:underline"
            >
              Directions
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
