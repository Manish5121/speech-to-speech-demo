import { useEffect, useState, useRef, useCallback } from "react"
import { UIMessage } from "ai"
import { useTextExtraction } from "@/app/hooks/useTextExtraction"

interface UseAutoTTSProps {
  readonly messages: UIMessage[]
  readonly chatStatus: string
  readonly setIsSynthesizing: (value: boolean) => void
  readonly selectedSpeaker: string
}

interface AudioChunk {
  id: string
  sentence: string
  order: number
  audioUrl: string | null
  isProcessing: boolean
}

/**
 * 🎯 REAL-TIME STREAMING TTS
 *
 * Processes LLM responses as they stream:
 * - Detects complete sentences during streaming
 * - Sends sentences to TTS immediately (no waiting)
 * - Manages sequential audio playback
 * - Ensures seamless, ordered audio experience
 */
export function useAutoTTS({
  messages,
  chatStatus,
  setIsSynthesizing,
  selectedSpeaker,
}: UseAutoTTSProps) {
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  const processedSentencesRef = useRef(new Set<string>())
  const audioQueueRef = useRef<{ audio: HTMLAudioElement; order: number }[]>([])
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const lastProcessedTextLengthRef = useRef(0)
  const sentenceBufferRef = useRef("")
  const orderCounterRef = useRef(0)
  const nextExpectedOrderRef = useRef(0) // Track next expected order for sequential playback
  const conversationIdRef = useRef<string | null>(null)
  const responseSpeakerRef = useRef<string | null>(null) // Lock speaker for current response only
  const playbackScheduledRef = useRef(false) // Prevent multiple playback schedules
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Timeout for buffer processing

  const { extractTextFromMessage } = useTextExtraction()

  // Get current assistant message being streamed
  const assistantMessages = messages.filter((msg) => msg.role === "assistant")
  const currentMessage = assistantMessages[assistantMessages.length - 1]
  const currentText = currentMessage
    ? extractTextFromMessage(
        currentMessage as unknown as Record<string, unknown>
      )
    : ""

  // Sequential audio playback - strict order enforcement
  const playNextInQueue = useCallback(async (): Promise<void> => {
    if (isPlaying) return

    // Find the next audio chunk that should play based on nextExpectedOrder
    const nextExpectedOrder = nextExpectedOrderRef.current
    const nextAudioIndex = audioQueueRef.current.findIndex(
      (item) => item.order === nextExpectedOrder
    )

    console.log(
      `🔍 Looking for chunk ${nextExpectedOrder} (queue: ${audioQueueRef.current.length} items)`
    )

    if (nextAudioIndex === -1) {
      console.log(`⏳ Waiting for chunk ${nextExpectedOrder}`)
      playbackScheduledRef.current = false // Clear the schedule flag since we can't play yet
      return // Wait for the next expected chunk
    }

    const { audio, order } = audioQueueRef.current.splice(nextAudioIndex, 1)[0]

    setIsPlaying(true)
    playbackScheduledRef.current = false // Clear the schedule flag
    currentAudioRef.current = audio
    nextExpectedOrderRef.current = order + 1 // Increment for next expected

    console.log(`🔊 Playing chunk ${order}`)

    const scheduleNext = () => {
      if (!playbackScheduledRef.current) {
        playbackScheduledRef.current = true
        setTimeout(() => {
          playNextInQueue()
        }, 50)
      }
    }

    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          console.log(`✅ Completed audio chunk ${order}`)
          currentAudioRef.current = null
          setIsPlaying(false)
          resolve()
          scheduleNext()
        }

        audio.onerror = (error) => {
          console.error(`❌ Audio error for chunk ${order}:`, error)
          currentAudioRef.current = null
          setIsPlaying(false)
          reject(new Error("Audio playback failed"))
          scheduleNext()
        }

        audio.play().catch(reject)
      })
    } catch (error) {
      console.error("❌ Playback error:", error)
      currentAudioRef.current = null
      setIsPlaying(false)
      scheduleNext()
    }
  }, [isPlaying])

  // Extract complete sentences from streaming text
  const extractSentences = useCallback((text: string): string[] => {
    if (!text.trim()) return []

    // Build complete text with buffer
    const fullText = sentenceBufferRef.current + text
    const sentences: string[] = []

    console.log(
      `🔍 Processing: "${fullText.slice(0, 80)}..." (${fullText.length} chars)`
    )

    // More natural chunking - focus on complete thoughts and phrases
    // Split on strong boundaries - handle punctuation with or without trailing space
    const strongBoundaries = fullText.split(/([.!?]+(?:\s+|$))/)
    let currentChunk = ""

    for (const part of strongBoundaries) {
      currentChunk += part

      if (/[.!?]+(?:\s+|$)/.test(part)) {
        // Complete sentence found
        const chunk = currentChunk.trim()

        if (chunk.length >= 20) {
          // ✅ AGGRESSIVE TTS: Process complete sentences even if short (20+ chars)
          console.log(
            `✅ Complete sentence: "${chunk}" (${chunk.length} chars)`
          )
          sentences.push(chunk)
          currentChunk = ""
        } else {
          console.log(
            `📝 Very short sentence, continuing: "${chunk}" (${chunk.length} chars)`
          )
          // Keep building for more natural flow
        }
      }
    }

    // For streaming: if we have a substantial chunk without sentence ending,
    // look for natural phrase boundaries (commas, conjunctions)
    if (currentChunk.length >= 80 && sentences.length === 0) {
      // Look for natural breaking points - after commas or conjunctions
      const phraseBreaks =
        /,\s+|;\s+|\s+and\s+|\s+but\s+|\s+or\s+|\s+so\s+|\s+because\s+|\s+however\s+/gi
      const matches = Array.from(currentChunk.matchAll(phraseBreaks))

      if (matches.length > 0) {
        // Find the last good break point
        const lastMatch = matches[matches.length - 1]
        const breakIndex = lastMatch.index! + lastMatch[0].length

        if (breakIndex >= 60) {
          // Ensure meaningful length
          const naturalChunk = currentChunk.substring(0, breakIndex).trim()
          const remaining = currentChunk.substring(breakIndex).trim()

          console.log(
            `🎯 Natural phrase break: "${naturalChunk}" (${naturalChunk.length} chars)`
          )
          sentences.push(naturalChunk)
          currentChunk = remaining
        }
      }
    }

    // Update buffer with incomplete chunk
    sentenceBufferRef.current = currentChunk
    if (sentences.length > 0) {
      console.log(`🎯 Extracted ${sentences.length} chunks for TTS`)
    }

    return sentences
  }, [])

  // Generate TTS for a sentence
  const generateTTS = useCallback(
    async (sentence: string, order: number): Promise<string | null> => {
      try {
        // Use the locked response speaker (consistent for current response only)
        const speakerToUse = responseSpeakerRef.current || selectedSpeaker

        console.log(
          `🎵 TTS ${order}: "${sentence.slice(0, 50)}..." (${speakerToUse})`
        )

        const response = await fetch("/api/synthesize-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sentence,
            speaker: speakerToUse,
          }),
        })

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

        console.log(`✅ TTS completed for chunk ${order}`)
        return audioUrl
      } catch (error) {
        console.error(`❌ TTS error for chunk ${order}:`, error)
        return null
      }
    },
    [selectedSpeaker]
  )

  // Process new sentences with strict ordering
  const processSentences = useCallback(
    async (sentences: string[]) => {
      if (sentences.length === 0) return

      console.log(`🔄 Processing ${sentences.length} sentences in PARALLEL`)

      // 🚀 PARALLEL PROCESSING: Start TTS for all sentences immediately
      sentences.forEach(async (sentence) => {
        if (processedSentencesRef.current.has(sentence)) return

        // 🔗 SMART HANDLING: If sentence is too short for API, pad it or combine
        if (sentence.trim().length < 28) {
          console.log(
            `🔗 SENTENCE NEEDS PADDING (${
              sentence.trim().length
            } chars): "${sentence}"`
          )

          // Strategy 1: Try to combine with previous chunk
          const lastChunk = audioChunks[audioChunks.length - 1]
          if (
            lastChunk &&
            !lastChunk.isProcessing &&
            lastChunk.sentence.length < 60
          ) {
            const combinedText = lastChunk.sentence + " " + sentence.trim()
            console.log(
              `🔗 COMBINING: "${lastChunk.sentence}" + "${sentence.trim()}"`
            )

            // Remove old chunk from queue if it exists
            const queueIndex = audioQueueRef.current.findIndex(
              (item) => item.order === lastChunk.order
            )
            if (queueIndex !== -1) {
              console.log(
                `🚫 Removing old audio chunk ${lastChunk.order} from queue`
              )
              audioQueueRef.current.splice(queueIndex, 1)
            }

            // Update the existing chunk with combined text and regenerate
            setAudioChunks((prev) =>
              prev.map((chunk) =>
                chunk.id === lastChunk.id
                  ? {
                      ...chunk,
                      sentence: combinedText,
                      isProcessing: true,
                      audioUrl: null,
                    }
                  : chunk
              )
            )

            // Mark both sentences as processed
            processedSentencesRef.current.add(sentence)

            // Regenerate TTS for combined text
            generateTTS(combinedText, lastChunk.order)
              .then((audioUrl) => {
                console.log(
                  `✅ COMBINED TTS completed for order ${lastChunk.order}`
                )

                setAudioChunks((prev) =>
                  prev.map((chunk) =>
                    chunk.id === lastChunk.id
                      ? { ...chunk, audioUrl, isProcessing: false }
                      : chunk
                  )
                )

                if (audioUrl) {
                  const audio = new Audio(audioUrl)
                  audioQueueRef.current.push({ audio, order: lastChunk.order })
                  console.log(
                    `🔗 Re-added combined audio ${lastChunk.order} to queue`
                  )

                  if (
                    !isPlaying &&
                    !currentAudioRef.current &&
                    !playbackScheduledRef.current
                  ) {
                    playbackScheduledRef.current = true
                    console.log(
                      `📅 Scheduling playback for combined chunk ${lastChunk.order}`
                    )
                    setTimeout(() => playNextInQueue(), 50)
                  }
                }
              })
              .catch((error) => {
                console.error(`❌ Combined TTS failed:`, error)
                setAudioChunks((prev) =>
                  prev.map((chunk) =>
                    chunk.id === lastChunk.id
                      ? { ...chunk, audioUrl: null, isProcessing: false }
                      : chunk
                  )
                )
              })

            return // Skip normal processing for this short sentence
          }

          // If no previous chunk to combine with, skip this short sentence
          console.log(
            `⚠️ Skipping short sentence (no previous chunk to combine): "${sentence}"`
          )
          processedSentencesRef.current.add(sentence)
          return
        }

        const order = orderCounterRef.current++
        processedSentencesRef.current.add(sentence)

        console.log(
          `📝 Creating TTS task ${order}: "${sentence.slice(0, 50)}..."`
        )

        // Create tracking chunk
        const chunk: AudioChunk = {
          id: `${Date.now()}-${order}`,
          sentence,
          order,
          audioUrl: null,
          isProcessing: true,
        }

        setAudioChunks((prev) => [...prev, chunk])

        // Generate TTS (don't await - process in parallel)
        generateTTS(sentence, order)
          .then((audioUrl) => {
            console.log(
              `🎵 TTS completed for order ${order}:`,
              audioUrl ? "SUCCESS" : "FAILED"
            )

            // Update chunk
            setAudioChunks((prev) =>
              prev.map((c) =>
                c.id === chunk.id ? { ...c, audioUrl, isProcessing: false } : c
              )
            )

            // Add to playback queue if successful
            if (audioUrl) {
              const audio = new Audio(audioUrl)
              audioQueueRef.current.push({ audio, order })

              console.log(
                `📝 Added audio ${order} to queue (queue length: ${audioQueueRef.current.length})`
              )

              // Schedule playback only if not already scheduled and not currently playing
              if (
                !isPlaying &&
                !currentAudioRef.current &&
                !playbackScheduledRef.current
              ) {
                playbackScheduledRef.current = true
                console.log(`📅 Scheduling playback for chunk ${order}`)
                setTimeout(() => playNextInQueue(), 50)
              }
            }
          })
          .catch((error) => {
            console.error(`❌ TTS failed for order ${order}:`, error)

            // Update chunk with error
            setAudioChunks((prev) =>
              prev.map((c) =>
                c.id === chunk.id
                  ? { ...c, audioUrl: null, isProcessing: false }
                  : c
              )
            )
          })
      })
    },
    [audioChunks, generateTTS, isPlaying, playNextInQueue]
  )

  // Monitor streaming text changes
  useEffect(() => {
    if (!currentMessage || !currentText) {
      // Reset speaker lock when no active response
      if (responseSpeakerRef.current) {
        console.log("🔓 Releasing speaker lock (no active response)")
        responseSpeakerRef.current = null
      }
      return
    }

    // Monitor incoming LLM response
    if (currentMessage.id !== conversationIdRef.current) {
      console.log("🔄 New conversation detected, resetting TTS state")

      // Reset all state for new conversation
      processedSentencesRef.current.clear()
      audioQueueRef.current = []
      lastProcessedTextLengthRef.current = 0
      sentenceBufferRef.current = ""
      orderCounterRef.current = 0
      nextExpectedOrderRef.current = 0 // Reset expected order for new conversation
      playbackScheduledRef.current = false // Reset playback scheduling
      conversationIdRef.current = currentMessage.id

      // Clear streaming timeout
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current)
        streamingTimeoutRef.current = null
      }

      // Stop current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }

      setAudioChunks([])
      setIsPlaying(false)
    }

    // 🎤 LOCK SPEAKER for this response (set for every response, not just new conversations)
    if (!responseSpeakerRef.current) {
      responseSpeakerRef.current = selectedSpeaker
      console.log(`🔒 Speaker locked for this response: ${selectedSpeaker}`)
    }

    // 🎯 AGGRESSIVE STREAMING PROCESSING
    // Process ANY text changes, not just during "streaming" status
    if (currentText.length > lastProcessedTextLengthRef.current) {
      const newText = currentText.slice(lastProcessedTextLengthRef.current)

      console.log(`📝 +${newText.length} chars: "${newText.slice(0, 40)}..."`)

      if (newText.length >= 5) {
        // Very low threshold for immediate processing
        const newSentences = extractSentences(newText)
        if (newSentences.length > 0) {
          console.log(`🎯 Processing ${newSentences.length} complete chunks`)
          processSentences(newSentences)
        } else {
          // Text buffered, waiting for complete chunks
        }

        lastProcessedTextLengthRef.current = currentText.length

        // 🚀 STREAMING TIMEOUT: Process buffer if no new text comes for 1.5 seconds
        if (streamingTimeoutRef.current) {
          clearTimeout(streamingTimeoutRef.current)
        }

        streamingTimeoutRef.current = setTimeout(() => {
          if (
            sentenceBufferRef.current.length >= 50 &&
            chatStatus === "loading"
          ) {
            console.log(
              `⏰ STREAMING TIMEOUT: Processing buffered text (${sentenceBufferRef.current.length} chars)`
            )
            console.log(`⏰ Buffer content: "${sentenceBufferRef.current}"`)

            // Force process the buffer as a natural chunk
            const bufferText = sentenceBufferRef.current.trim()
            if (bufferText.length >= 50) {
              console.log(
                `🚀 TIMEOUT CHUNK: "${bufferText}" (${bufferText.length} chars)`
              )
              processSentences([bufferText])
              sentenceBufferRef.current = "" // Clear buffer after processing
            }
          }
        }, 1500) // 1.5 second timeout for truly streaming response
      }
    }

    // Also check for partial sentences that might be worth processing
    if (chatStatus === "streaming" && currentText.length >= 50) {
      const currentBuffer = sentenceBufferRef.current
      if (currentBuffer.length >= 30) {
        // Process long phrases even without punctuation
        console.log(
          `🔥 PROCESSING LONG PHRASE: "${currentBuffer.slice(0, 50)}..."`
        )
        processSentences([currentBuffer])
        sentenceBufferRef.current = ""
      }
    }

    // Handle completion - process any remaining buffered content
    if (chatStatus === "idle" && sentenceBufferRef.current.trim()) {
      const remainingText = sentenceBufferRef.current.trim()

      if (remainingText.length < 28) {
        // If remaining text is too short for TTS, append to previous sentence
        console.log(
          `🔗 SHORT REMAINING TEXT (${remainingText.length} chars): "${remainingText}"`
        )

        const lastChunk = audioChunks[audioChunks.length - 1]
        if (lastChunk && !lastChunk.isProcessing) {
          const combinedText = lastChunk.sentence + " " + remainingText
          console.log(
            `🔗 COMBINING WITH PREVIOUS: "${lastChunk.sentence}" + "${remainingText}"`
          )
          console.log(`🔗 COMBINED RESULT: "${combinedText}"`)

          // Cancel current audio for the last chunk if it's in queue but not playing
          const queueIndex = audioQueueRef.current.findIndex(
            (item) => item.order === lastChunk.order
          )
          if (queueIndex !== -1) {
            console.log(
              `🚫 Removing old audio chunk ${lastChunk.order} from queue`
            )
            audioQueueRef.current.splice(queueIndex, 1)
          }

          // Mark the old chunk as processing and regenerate with combined text
          setAudioChunks((prev) =>
            prev.map((chunk) =>
              chunk.id === lastChunk.id
                ? {
                    ...chunk,
                    sentence: combinedText,
                    isProcessing: true,
                    audioUrl: null,
                  }
                : chunk
            )
          )

          // Regenerate TTS for combined text using same order
          generateTTS(combinedText, lastChunk.order)
            .then((audioUrl) => {
              console.log(
                `✅ COMBINED TTS completed for order ${lastChunk.order}`
              )

              setAudioChunks((prev) =>
                prev.map((chunk) =>
                  chunk.id === lastChunk.id
                    ? { ...chunk, audioUrl, isProcessing: false }
                    : chunk
                )
              )

              if (audioUrl) {
                const audio = new Audio(audioUrl)
                audioQueueRef.current.push({ audio, order: lastChunk.order })
                console.log(
                  `🔗 Re-added combined audio ${lastChunk.order} to queue`
                )

                // Try to play if not currently playing
                if (
                  !isPlaying &&
                  !currentAudioRef.current &&
                  !playbackScheduledRef.current
                ) {
                  playbackScheduledRef.current = true
                  console.log(
                    `📅 Scheduling playback for combined chunk ${lastChunk.order}`
                  )
                  setTimeout(() => playNextInQueue(), 50)
                }
              }
            })
            .catch((error) => {
              console.error(
                `❌ Combined TTS failed for order ${lastChunk.order}:`,
                error
              )
              setAudioChunks((prev) =>
                prev.map((chunk) =>
                  chunk.id === lastChunk.id
                    ? { ...chunk, audioUrl: null, isProcessing: false }
                    : chunk
                )
              )
            })
        } else {
          // No previous chunk to combine with, process as-is if long enough
          if (remainingText.length >= 10) {
            console.log(`🏁 PROCESSING SHORT FINAL CONTENT: "${remainingText}"`)
            processSentences([remainingText])
          } else {
            console.log(
              `⚠️ Skipping very short remaining text: "${remainingText}"`
            )
          }
        }
      } else {
        // Remaining text is long enough, process normally
        console.log(`🏁 PROCESSING FINAL CONTENT: "${remainingText}"`)
        processSentences([remainingText])
      }

      sentenceBufferRef.current = ""
    }

    // Cleanup function to clear timeout when effect reruns or unmounts
    return () => {
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current)
        streamingTimeoutRef.current = null
      }
    }
  }, [
    currentText,
    chatStatus,
    currentMessage,
    extractSentences,
    processSentences,
    audioChunks,
    generateTTS,
    isPlaying,
    playNextInQueue,
    selectedSpeaker,
  ])

  // Update synthesis status and check queue
  useEffect(() => {
    const isProcessing = audioChunks.some((chunk) => chunk.isProcessing)
    const hasQueuedAudio = audioQueueRef.current.length > 0
    const isBusy = isProcessing || isPlaying || hasQueuedAudio

    setIsSynthesizing(isBusy)

    // Periodically check if we can play the next audio in order
    if (!isPlaying && hasQueuedAudio && !playbackScheduledRef.current) {
      playbackScheduledRef.current = true
      console.log(`📅 Scheduling periodic check for next audio`)
      const timer = setTimeout(() => {
        playNextInQueue()
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [audioChunks, isPlaying, setIsSynthesizing, playNextInQueue])
}
