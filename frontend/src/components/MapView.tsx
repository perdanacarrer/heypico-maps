import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAppStore } from '../store/appStore'
import { Place } from '../types'
import { osmDirectionsUrl, googleMapsUrl } from '../utils/api'
import { MapPin, Navigation, ExternalLink } from 'lucide-react'

// Fix Leaflet default icon path issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom numbered marker icon
function createNumberedIcon(n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:#6c63ff;color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-family:DM Sans,sans-serif;font-size:12px;font-weight:700;
      border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);
    ">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

// Star rating display
function Stars({ rating }: { rating?: number }) {
  if (!rating) return null
  return (
    <span style={{ color: '#fbbf24', fontSize: 12 }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
      <span style={{ color: '#888', marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
  )
}

// Component to recenter map reactively
function MapController({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([center.lat, center.lng], zoom, { duration: 1.2 }) }, [center.lat, center.lng, zoom])
  return null
}

export function MapView() {
  const { mapCenter, mapZoom, highlightedPlaces, setSelectedPlace } = useAppStore()

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/5">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={mapZoom}
        className="w-full h-full"
        zoomControl={true}
        style={{ background: '#1a1a2e' }}
      >
        {/* Dark tile layer from CartoDB */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        <MapController center={mapCenter} zoom={mapZoom} />

        {highlightedPlaces.map((place, idx) => (
          <Marker
            key={place.place_id}
            position={[place.lat, place.lng]}
            icon={createNumberedIcon(idx + 1)}
            eventHandlers={{ click: () => setSelectedPlace(place) }}
          >
            <Popup
              className="heypico-popup"
              maxWidth={280}
            >
              <div style={{
                fontFamily: 'DM Sans, sans-serif',
                background: '#1e1e28',
                color: '#e2e2e2',
                padding: '4px 0',
                minWidth: 220,
              }}>
                <strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                  {place.name}
                </strong>
                {place.address && (
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>{place.address}</div>
                )}
                {place.cuisine && (
                  <div style={{ fontSize: 12, color: '#a78bfa', marginBottom: 4 }}>🍽 {place.cuisine}</div>
                )}
                {place.opening_hours && (
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>🕐 {place.opening_hours}</div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                  <a
                    href={osmDirectionsUrl(place.lat, place.lng, place.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#6c63ff', fontSize: 12, textDecoration: 'none' }}
                  >
                    🧭 Directions (OSM)
                  </a>
                  <a
                    href={googleMapsUrl(place.lat, place.lng, place.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4ade80', fontSize: 12, textDecoration: 'none' }}
                  >
                    📍 Google Maps
                  </a>
                  {place.website && (
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#fbbf24', fontSize: 12, textDecoration: 'none' }}
                    >
                      🌐 Website
                    </a>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Badge */}
      {highlightedPlaces.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-surface-2/90 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-accent" />
          <span className="text-white/70 text-xs font-mono">{highlightedPlaces.length} places found</span>
        </div>
      )}

      {/* Attribution badge */}
      <div className="absolute bottom-6 left-4 z-[1000] bg-surface-2/70 backdrop-blur-sm rounded-full px-2 py-0.5">
        <span className="text-white/30 text-[10px] font-mono">© OpenStreetMap • Free, no API key</span>
      </div>
    </div>
  )
}
