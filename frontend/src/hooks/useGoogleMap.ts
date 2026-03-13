import { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { getMapsKey } from '../utils/api'
import { Place } from '../types'

const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6272a4' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e1e30' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2f1a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#222240' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3d3d60' }] },
]

export function useGoogleMap(
  mapRef: React.RefObject<HTMLDivElement>,
  center: { lat: number; lng: number },
  zoom: number
) {
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function initMap() {
      try {
        const key = await getMapsKey()
        const loader = new Loader({ apiKey: key, version: 'weekly', libraries: ['places', 'marker'] })
        await loader.load()

        if (!mapRef.current || !mounted) return

        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          styles: DARK_MAP_STYLE,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        })

        mapInstanceRef.current = map
        infoWindowRef.current = new google.maps.InfoWindow()
        if (mounted) setMapReady(true)
      } catch (e) {
        if (mounted) setError('Failed to load Google Maps. Check your API key.')
      }
    }
    initMap()
    return () => { mounted = false }
  }, [])

  // Pan to new center
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(center)
      mapInstanceRef.current.setZoom(zoom)
    }
  }, [center.lat, center.lng, zoom])

  const placeMarkers = (places: Place[], onSelect: (p: Place) => void) => {
    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    places.forEach((place, idx) => {
      const marker = new google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        label: {
          text: String(idx + 1),
          color: '#fff',
          fontFamily: 'DM Sans',
          fontWeight: '600',
          fontSize: '12px',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: '#6c63ff',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        animation: google.maps.Animation.DROP,
      })

      marker.addListener('click', () => {
        onSelect(place)
        infoWindowRef.current?.setContent(`
          <div style="font-family:DM Sans,sans-serif;padding:8px;min-width:200px;">
            <strong style="font-size:14px;">${place.name}</strong>
            <div style="color:#666;font-size:12px;margin-top:4px;">${place.address}</div>
            ${place.rating ? `<div style="color:#fbbf24;margin-top:4px;">★ ${place.rating} (${place.user_ratings_total?.toLocaleString()} reviews)</div>` : ''}
            <a href="https://www.google.com/maps/place/?q=place_id:${place.place_id}" target="_blank" 
               style="display:inline-block;margin-top:8px;color:#6c63ff;font-size:12px;text-decoration:none;">
              View on Google Maps →
            </a>
          </div>
        `)
        infoWindowRef.current?.open(mapInstanceRef.current, marker)
      })

      markersRef.current.push(marker)
    })
  }

  const clearMarkers = () => {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    infoWindowRef.current?.close()
  }

  return { mapReady, error, placeMarkers, clearMarkers }
}
