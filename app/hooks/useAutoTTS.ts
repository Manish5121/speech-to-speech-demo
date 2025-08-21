import { useEffect, useState } from "react"
import { UIMessage } from "ai"
import { useTextExtraction } from "@/app/hooks/useTextExtraction"
import { useSpeechSynthesis } from "@/app/hooks/useSpeechSynthesis"

interface UseAutoTTSProps {
  readonly messages: UIMessage[]
  readonly chatStatus: string
  readonly setIsSynthesizing: (value: boolean) => void
}

/**
 * Custom hook that handles automatic text-to-speech for new assistant messages
 * Tracks processed messages and triggers TTS for new responses
 */
export function useAutoTTS({
  messages,
  chatStatus,
  setIsSynthesizing,
}: UseAutoTTSProps) {
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<
    string | null
  >(null)
  const { extractTextFromMessage } = useTextExtraction()
  const { synthesizeSpeech } = useSpeechSynthesis()

  useEffect(() => {
    if (chatStatus === "idle" && messages.length > 0) {
      const latestMessage = messages[messages.length - 1]

      if (
        latestMessage?.role === "assistant" &&
        latestMessage.id !== lastProcessedMessageId
      ) {
        const textContent = extractTextFromMessage(
          latestMessage as unknown as Record<string, unknown>
        )
        if (textContent) {
          setIsSynthesizing(true)
          synthesizeSpeech(textContent).finally(() => setIsSynthesizing(false))
        }
        setLastProcessedMessageId(latestMessage.id)
      }
    }
  }, [
    messages,
    chatStatus,
    lastProcessedMessageId,
    extractTextFromMessage,
    synthesizeSpeech,
    setIsSynthesizing,
  ])
}
