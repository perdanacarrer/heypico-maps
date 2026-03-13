import { useCallback } from 'react'
import { v4 as uuidv4 } from 'crypto'
import { useAppStore } from '../store/appStore'
import { sendChat } from '../utils/api'
import { ChatMessage } from '../types'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now()
}

export function useChat() {
  const { messages, addMessage, setLoading, setMapCenter, setHighlightedPlaces } = useAppStore()

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }
    addMessage(userMsg)
    setLoading(true)

    // Build history for context (last 8 messages)
    const history = messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const response = await sendChat(text.trim(), history)

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: response.user_message,
        timestamp: new Date(),
        places: response.places,
        mapCenter: response.map_center ?? undefined,
        searchQuery: response.search_query ?? undefined,
      }

      addMessage(assistantMsg)

      if (response.map_center) {
        setMapCenter(response.map_center, 14)
      }

      if (response.places?.length) {
        setHighlightedPlaces(response.places)
      }
    } catch (err) {
      addMessage({
        id: genId(),
        role: 'assistant',
        content: "Sorry, I had trouble connecting. Please check that the backend is running and try again.",
        timestamp: new Date(),
      })
    } finally {
      setLoading(false)
    }
  }, [messages, addMessage, setLoading, setMapCenter, setHighlightedPlaces])

  return { sendMessage }
}
