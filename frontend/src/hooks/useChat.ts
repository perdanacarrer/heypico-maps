import { useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { sendChat } from '../utils/api'
import { ChatMessage } from '../types'

const genId = () => Math.random().toString(36).slice(2) + Date.now()

export function useChat() {
  const { messages, addMessage, setLoading, setMapCenter, setHighlightedPlaces } = useAppStore()

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    addMessage({ id: genId(), role: 'user', content: text.trim(), timestamp: new Date() })
    setLoading(true)

    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await sendChat(text.trim(), history)

      addMessage({
        id: genId(),
        role: 'assistant',
        content: res.user_message,
        timestamp: new Date(),
        places: res.places,
        mapCenter: res.map_center ?? undefined,
        searchQuery: res.search_query ?? undefined,
      })

      if (res.map_center) setMapCenter(res.map_center, 14)
      if (res.places?.length) setHighlightedPlaces(res.places)
    } catch {
      addMessage({
        id: genId(),
        role: 'assistant',
        content: 'Sorry, I had trouble connecting to the server. Please make sure Docker is running.',
        timestamp: new Date(),
      })
    } finally {
      setLoading(false)
    }
  }, [messages, addMessage, setLoading, setMapCenter, setHighlightedPlaces])

  return { sendMessage }
}
