import { useState } from "react"

interface SpeechSynthesisHook {
  isSynthesizing: boolean
  setIsSynthesizing: (value: boolean) => void
}

/**
 * Custom hook for managing TTS state
 * Provides state management for synthesis status across components
 */
export const useSpeechSynthesis = (): SpeechSynthesisHook => {
  const [isSynthesizing, setIsSynthesizing] = useState(false)

  return {
    isSynthesizing,
    setIsSynthesizing,
  }
}
