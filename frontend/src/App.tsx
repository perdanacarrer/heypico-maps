import { ChatPanel } from './components/ChatPanel'
import { MapView } from './components/MapView'

export default function App() {
  return (
    <div className="h-screen w-screen bg-surface flex overflow-hidden font-sans">
      {/* Chat sidebar */}
      <div className="w-[400px] flex-shrink-0 h-full border-r border-white/5 bg-surface-1">
        <ChatPanel />
      </div>

      {/* Map area */}
      <div className="flex-1 h-full p-4">
        <MapView />
      </div>
    </div>
  )
}
