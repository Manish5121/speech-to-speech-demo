import { useCallback, useRef, useEffect } from "react"

/**
 * 🎵 TTS GENERATION HOOK
 *
 * Extracted from useAutoTTS - handles TTS API calls and audio generation
 * - Manages TTS API requests with proper error handling
 * - Handles speaker consistency and voice locking
 * - Creates audio objects from blob responses
 * - Provides audio URL generation and cleanup
 * - Supports request cancellation and memory cleanup
 */

export function useTTSGeneration() {
  const audioUrlsRef = useRef<Set<string>>(new Set())
  const abortControllersRef = useRef<Set<AbortController>>(new Set())

  // Cleanup function for URLs and abort controllers
  useEffect(() => {
    // Copy refs to local variables to capture current values
    const audioUrls = audioUrlsRef.current
    const abortControllers = abortControllersRef.current

    return () => {
      // Clean up all audio URLs on unmount
      audioUrls.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      audioUrls.clear()

      // Abort all pending requests
      abortControllers.forEach((controller) => {
        controller.abort()
      })
      abortControllers.clear()

      console.log("🧹 TTS Generation cleanup completed")
    }
  }, [])

  // Generate TTS for a sentence with abort support
  const generateTTS = useCallback(
    async (
      sentence: string,
      selectedSpeaker: string,
      signal?: AbortSignal
    ): Promise<string | null> => {
      try {
        console.log(
          `🎵 TTS: "${sentence.slice(0, 50)}..." (${selectedSpeaker})`
        )

        // Create abort controller if none provided
        const abortController = new AbortController()
        const requestSignal = signal || abortController.signal

        // Track the controller for cleanup
        if (!signal) {
          abortControllersRef.current.add(abortController)
        }

        const response = await fetch("/api/synthesize-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sentence,
            speaker: selectedSpeaker,
          }),
          signal: requestSignal,
        })

        // Remove from tracking after request completes
        if (!signal) {
          abortControllersRef.current.delete(abortController)
        }

        if (!response.ok) {
          if (response.status === 400) {
            console.warn(
              `⚠️ Sentence too short for TTS: ${sentence.length} chars`
            )
            return null
          }
          throw new Error(`TTS failed: ${response.status}`)
        }

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)

        // Track URL for cleanup
        audioUrlsRef.current.add(audioUrl)

        console.log(`✅ TTS completed`)
        return audioUrl
      } catch (error) {
        // Handle abort specifically
        if (error instanceof Error && error.name === "AbortError") {
          console.log(
            `🚫 TTS request aborted for: "${sentence.slice(0, 30)}..."`
          )
          return null
        }
        console.error(`❌ TTS error:`, error)
        return null
      }
    },
    []
  )

  // Generate multiple TTS requests in parallel
  const generateParallelTTS = useCallback(
    async (
      sentences: string[],
      selectedSpeaker: string
    ): Promise<(string | null)[]> => {
      console.log(`🚀 Starting parallel TTS for ${sentences.length} sentences`)

      const promises = sentences.map((sentence) =>
        generateTTS(sentence, selectedSpeaker)
      )

      const results = await Promise.allSettled(promises)

      return results.map((result) =>
        result.status === "fulfilled" ? result.value : null
      )
    },
    [generateTTS]
  )

  // Check if sentence is too short for TTS API
  const isSentenceTooShort = useCallback((sentence: string): boolean => {
    return sentence.trim().length < 28
  }, [])

  // Create audio object from URL with preloading for seamless playback
  const createAudioFromUrl = useCallback(
    (audioUrl: string): HTMLAudioElement => {
      const audio = new Audio(audioUrl)
      audio.preload = "auto" // Preload audio data for seamless playback
      audio.load() // Start loading immediately
      return audio
    },
    []
  )

  // Clean up audio URL and remove from tracking
  const cleanupAudioUrl = useCallback((audioUrl: string) => {
    URL.revokeObjectURL(audioUrl)
    audioUrlsRef.current.delete(audioUrl)
    console.log(`🧹 Cleaned up audio URL`)
  }, [])

  // Cancel all pending TTS requests
  const cancelAllRequests = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      controller.abort()
    })
    abortControllersRef.current.clear()
    console.log(
      `🚫 Cancelled ${abortControllersRef.current.size} pending TTS requests`
    )
  }, [])

  return {
    generateTTS,
    generateParallelTTS,
    isSentenceTooShort,
    createAudioFromUrl,
    cleanupAudioUrl,
    cancelAllRequests,
  }
}
