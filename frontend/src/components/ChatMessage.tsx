import { ChatMessage as ChatMessageType } from '../types'
import { PlaceCard } from './PlaceCard'
import { Bot, User } from 'lucide-react'

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 animate-fade-up ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
        ${isUser ? 'bg-accent/20 border border-accent/30' : 'bg-surface-3 border border-white/10'}`}>
        {isUser ? <User className="w-4 h-4 text-accent" /> : <Bot className="w-4 h-4 text-white/60" />}
      </div>

      <div className={`flex-1 max-w-[85%] flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line
          ${isUser
            ? 'bg-accent text-white rounded-tr-sm ml-auto'
            : 'bg-surface-2 text-white/80 border border-white/5 rounded-tl-sm'
          }`}>
          {message.content.split(/\*(.+?)\*/g).map((part, i) =>
            i % 2 === 1
              ? <em key={i} className="not-italic font-semibold text-white">{part}</em>
              : <span key={i}>{part}</span>
          )}
        </div>

        {message.places && message.places.length > 0 && (
          <div className="w-full space-y-2 mt-1">
            <p className="text-white/30 text-xs font-mono px-1">{message.places.length} locations found</p>
            {message.places.map((place, idx) => (
              <PlaceCard key={place.place_id} place={place} index={idx} />
            ))}
          </div>
        )}

        <span className="text-white/20 text-xs font-mono px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
