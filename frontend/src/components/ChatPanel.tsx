import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { Sparkles } from 'lucide-react'

export function ChatPanel() {
  const { messages, isLoading } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h1 className="text-white font-display font-semibold text-sm">HeyPico Maps</h1>
          <p className="text-white/30 text-xs font-mono">AI Local Guide</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          <span className="text-white/30 text-xs">Live</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-3 animate-fade-up">
            <div className="w-8 h-8 rounded-xl bg-surface-3 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white/40" />
            </div>
            <div className="bg-surface-2 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse-dot"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-4 border-t border-white/5">
        <ChatInput />
      </div>
    </div>
  )
}
