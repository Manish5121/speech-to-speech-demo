import { useCallback, useRef } from "react"

/**
 * 🌊 STREAMING BUFFER HOOK
 *
 * Extracted from useAutoTTS - manages text buffering and streaming coordination
 * - Handles streaming text accumulation and processing timing
 * - Manages timeout-based buffer processing
 * - Coordinates with text chunking for optimal sentence detection
 * - Provides streaming state management
 */

export function useStreamingBuffer() {
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Set streaming timeout for buffer processing (copied from useAutoTTS logic)
  const setStreamingTimeout = useCallback(
    (callback: () => void, delay: number = 1500) => {
      // Clear existing timeout
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current)
      }

      // Set new timeout
      streamingTimeoutRef.current = setTimeout(callback, delay)
    },
    []
  )

  // Clear streaming timeout
  const clearStreamingTimeout = useCallback(() => {
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current)
      streamingTimeoutRef.current = null
    }
  }, [])

  // Check if timeout is active
  const hasActiveTimeout = useCallback(() => {
    return streamingTimeoutRef.current !== null
  }, [])

  // Force process buffer with timeout (from useAutoTTS pattern)
  const scheduleBufferProcessing = useCallback(
    (
      bufferContent: string,
      chatStatus: string,
      processCallback: (content: string) => void,
      minLength: number = 50
    ) => {
      if (bufferContent.length >= minLength && chatStatus === "loading") {
        console.log(
          `⏰ STREAMING TIMEOUT: Processing buffered text (${bufferContent.length} chars)`
        )
        console.log(`⏰ Buffer content: "${bufferContent}"`)

        // Force process the buffer as a natural chunk
        const bufferText = bufferContent.trim()
        if (bufferText.length >= minLength) {
          console.log(
            `🚀 TIMEOUT CHUNK: "${bufferText}" (${bufferText.length} chars)`
          )
          processCallback(bufferText)
        }
      }
    },
    []
  )

  // Process long phrases during streaming (from useAutoTTS logic)
  const processLongPhrase = useCallback(
    (
      currentBuffer: string,
      processCallback: (content: string) => void,
      clearBufferCallback: () => void,
      minLength: number = 30
    ) => {
      if (currentBuffer.length >= minLength) {
        console.log(
          `� PROCESSING LONG PHRASE: "${currentBuffer.slice(0, 50)}..."`
        )
        processCallback(currentBuffer)
        clearBufferCallback()
      }
    },
    []
  )

  // Handle final buffer processing on completion (from useAutoTTS pattern)
  const processFinalBuffer = useCallback(
    (
      remainingText: string,
      audioChunks: Array<{
        id: string
        sentence: string
        order: number
        audioUrl: string | null
        isProcessing: boolean
      }>,
      generateTTSCallback: (text: string, order: number) => void,
      orderCounterRef: { current: number },
      minLength: number = 28
    ) => {
      if (remainingText.length < minLength) {
        // If remaining text is too short for TTS, try to combine with previous
        console.log(
          `🔗 SHORT REMAINING TEXT (${remainingText.length} chars): "${remainingText}"`
        )

        const lastChunk = audioChunks[audioChunks.length - 1]
        if (lastChunk && !lastChunk.isProcessing) {
          const combinedText = lastChunk.sentence + " " + remainingText
          console.log(
            `🔗 COMBINING WITH PREVIOUS: "${lastChunk.sentence}" + "${remainingText}"`
          )
          return { shouldCombine: true, combinedText, lastChunk }
        }

        // No previous chunk to combine with
        if (remainingText.length >= 10) {
          console.log(`🏁 PROCESSING SHORT FINAL CONTENT: "${remainingText}"`)
          return { shouldProcess: true, content: remainingText }
        }

        console.log(`⚠️ Skipping very short remaining text: "${remainingText}"`)
        return { shouldSkip: true }
      }

      // Remaining text is long enough, process normally
      console.log(`🏁 PROCESSING FINAL CONTENT: "${remainingText}"`)
      return { shouldProcess: true, content: remainingText }
    },
    []
  )

  // Cleanup function
  const cleanup = useCallback(() => {
    clearStreamingTimeout()
  }, [clearStreamingTimeout])

  return {
    // Timeout management
    setStreamingTimeout,
    clearStreamingTimeout,
    hasActiveTimeout,

    // Buffer processing strategies
    scheduleBufferProcessing,
    processLongPhrase,
    processFinalBuffer,

    // Cleanup
    cleanup,
  }
}
