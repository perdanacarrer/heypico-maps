import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAppStore } from '../store/appStore'
import { Place } from '../types'
import { osmDirectionsUrl, googleMapsDirectionsUrl, getUserLocation } from '../utils/api'
import { MapPin, LocateFixed } from 'lucide-react'

// Fix Leaflet icon path in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function createNumberedIcon(n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#6c63ff;color:#fff;display:flex;align-items:center;justify-content:center;font-family:DM Sans,sans-serif;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function createUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#4ade80;border:3px solid #fff;box-shadow:0 0 0 4px rgba(74,222,128,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function MapController({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([center.lat, center.lng], zoom, { duration: 1.2 }) }, [center.lat, center.lng, zoom])
  return null
}

function LocateButton() {
  const { setMapCenter, setUserLocation, userLocation } = useAppStore()

  const handleLocate = async () => {
    try {
      const loc = await getUserLocation()
      setUserLocation(loc)
      setMapCenter(loc, 15)
    } catch {
      alert('Could not get your location. Please allow location access in your browser.')
    }
  }

  return (
    <button
      onClick={handleLocate}
      title="Show my location"
      className={`absolute bottom-20 right-3 z-[1000] w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all
        ${userLocation
          ? 'bg-accent-green/20 border border-accent-green/40 text-accent-green'
          : 'bg-surface-2/90 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:border-white/20'
        }`}
    >
      <LocateFixed className="w-4 h-4" />
    </button>
  )
}

export function MapView() {
  const { mapCenter, mapZoom, highlightedPlaces, userLocation, setSelectedPlace } = useAppStore()

  const buildPopupHtml = (place: Place) => {
    const osmUrl = osmDirectionsUrl(place.lat, place.lng, place.name, userLocation?.lat, userLocation?.lng)
    const gUrl = googleMapsDirectionsUrl(place.lat, place.lng, place.name, userLocation?.lat, userLocation?.lng)
    const locationNote = userLocation ? '📍 Using your location' : '⚠️ Allow location for better directions'
    return `
      <div style="font-family:DM Sans,sans-serif;padding:4px 0;min-width:220px;">
        <strong style="font-size:14px;display:block;margin-bottom:4px;color:#e2e2e2;">${place.name}</strong>
        ${place.address ? `<div style="color:#888;font-size:12px;margin-bottom:6px;">${place.address}</div>` : ''}
        ${place.cuisine ? `<div style="font-size:12px;color:#a78bfa;margin-bottom:4px;">🍽 ${place.cuisine}</div>` : ''}
        ${place.opening_hours ? `<div style="font-size:12px;color:#888;margin-bottom:6px;">🕐 ${place.opening_hours}</div>` : ''}
        <div style="font-size:10px;color:#666;margin-bottom:8px;">${locationNote}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a href="${osmUrl}" target="_blank" rel="noopener noreferrer"
            style="color:#6c63ff;font-size:12px;text-decoration:none;">🧭 OSM Directions</a>
          <a href="${gUrl}" target="_blank" rel="noopener noreferrer"
            style="color:#4ade80;font-size:12px;text-decoration:none;">📍 Google Maps</a>
          ${place.website ? `<a href="${place.website}" target="_blank" rel="noopener noreferrer" style="color:#fbbf24;font-size:12px;text-decoration:none;">🌐 Website</a>` : ''}
        </div>
      </div>`
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/5">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={mapZoom}
        className="w-full h-full"
        style={{ background: '#1a1a2e' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        <MapController center={mapCenter} zoom={mapZoom} />

        {/* Place markers */}
        {highlightedPlaces.map((place, idx) => (
          <Marker
            key={place.place_id}
            position={[place.lat, place.lng]}
            icon={createNumberedIcon(idx + 1)}
            eventHandlers={{ click: () => setSelectedPlace(place) }}
          >
            <Popup maxWidth={280}>
              <div dangerouslySetInnerHTML={{ __html: buildPopupHtml(place) }} />
            </Popup>
          </Marker>
        ))}

        {/* User location marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={createUserIcon()}>
            <Popup>
              <div style={{ fontFamily: 'DM Sans,sans-serif', color: '#e2e2e2', padding: '4px 0' }}>
                <strong style={{ color: '#4ade80' }}>📍 Your location</strong>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Place count badge */}
      {highlightedPlaces.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-surface-2/90 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-accent" />
          <span className="text-white/70 text-xs font-mono">{highlightedPlaces.length} places found</span>
        </div>
      )}

      {/* Locate me button */}
      <LocateFixed className="hidden" />
      <LocateButton />

      <div className="absolute bottom-6 left-4 z-[1000] bg-surface-2/70 backdrop-blur-sm rounded-full px-2 py-0.5">
        <span className="text-white/30 text-[10px] font-mono">© OpenStreetMap • Free, no API key</span>
      </div>
    </div>
  )
}
