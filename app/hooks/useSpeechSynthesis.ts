import { useState, useCallback } from "react"

interface SpeechSynthesisHook {
  isSynthesizing: boolean
  synthesizeSpeech: (text: string) => Promise<void>
}

/**
 * Custom hook for text-to-speech functionality
 * Handles communication with the synthesize API and audio playback
 */
export const useSpeechSynthesis = (): SpeechSynthesisHook => {
  const [isSynthesizing, setIsSynthesizing] = useState(false)

  const synthesizeSpeech = useCallback(async (text: string) => {
    setIsSynthesizing(true)

    try {
      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`)
      }

      const result = await response.json()

      if (result.audio_data) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(result.audio_data), (c) => c.charCodeAt(0))],
          { type: result.content_type || "audio/wav" }
        )

        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
        }

        await audio.play()
      } else if (result.audio_url) {
        const audio = new Audio(result.audio_url)
        await audio.play()
      }
    } catch (error) {
      console.error("Speech synthesis error:", error)
    } finally {
      setIsSynthesizing(false)
    }
  }, [])

  return {
    isSynthesizing,
    synthesizeSpeech,
  }
}
