import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useChat } from '../hooks/useChat'

const SUGGESTIONS = [
  'Best ramen restaurants nearby',
  'Coffee shops open now',
  'Tourist attractions to visit',
  'Rooftop bars with views',
]

export function ChatInput() {
  const [input, setInput] = useState('')
  const { isLoading } = useAppStore()
  const { sendMessage } = useChat()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return
    const msg = input.trim()
    setInput('')
    await sendMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  return (
    <div className="space-y-3">
      {/* Suggestion chips */}
      <div className="flex gap-2 flex-wrap">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setInput(s); textareaRef.current?.focus() }}
            className="text-xs text-white/40 hover:text-white/70 bg-surface-2 hover:bg-surface-3 border border-white/5 hover:border-white/10 rounded-full px-3 py-1 transition-all"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex gap-3 items-end bg-surface-2 border border-white/10 focus-within:border-accent/40 rounded-2xl p-3 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me to find places…"
          rows={1}
          disabled={isLoading}
          className="flex-1 bg-transparent text-white placeholder:text-white/25 text-sm font-sans resize-none outline-none leading-relaxed min-h-[24px]"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-accent hover:bg-accent/80 disabled:bg-surface-3 disabled:cursor-not-allowed flex items-center justify-center transition-all"
        >
          {isLoading
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : <Send className="w-4 h-4 text-white" />
          }
        </button>
      </div>
    </div>
  )
}
