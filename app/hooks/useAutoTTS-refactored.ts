import { useEffect, useState, useRef, useCallback } from "react"
import { UIMessage } from "ai"
import { useTextExtraction } from "@/app/hooks/useTextExtraction"
import { useTextChunking } from "./useTextChunking"
import { useTTSGeneration } from "./useTTSGeneration"
import { useAudioPlayback } from "./useAudioPlayback"
import { useStreamingBuffer } from "./useStreamingBuffer"

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
 * 🎯 ORCHESTRATED REAL-TIME STREAMING TTS
 *
 * Uses modular hooks to recreate the exact functionality of useAutoTTS:
 * - useTextChunking: Sentence detection and parsing
 * - useTTSGeneration: Parallel TTS API calls
 * - useAudioPlayback: Sequential audio queue management
 * - useStreamingBuffer: Streaming coordination and timeouts
 */
export function useAutoTTS({
  messages,
  chatStatus,
  setIsSynthesizing,
  selectedSpeaker,
}: UseAutoTTSProps) {
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([])

  // Initialize component hooks
  const textChunking = useTextChunking()
  const ttsGeneration = useTTSGeneration()
  const audioPlayback = useAudioPlayback()
  const streamingBuffer = useStreamingBuffer()
  const { extractTextFromMessage } = useTextExtraction()

  // Cleanup effect for unmount only
  useEffect(() => {
    return () => {
      // Cancel any pending TTS requests
      ttsGeneration.cancelAllRequests()

      console.log("🧹 useAutoTTS cleanup completed")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency - cleanup only on unmount

  // Original useAutoTTS refs and state
  const processedSentencesRef = useRef(new Set<string>())
  const lastProcessedTextLengthRef = useRef(0)
  const orderCounterRef = useRef(0)
  const conversationIdRef = useRef<string | null>(null)
  const responseSpeakerRef = useRef<string | null>(null)

  // Get current assistant message being streamed
  const assistantMessages = messages.filter((msg) => msg.role === "assistant")
  const currentMessage = assistantMessages[assistantMessages.length - 1]
  const currentText = currentMessage
    ? extractTextFromMessage(
        currentMessage as unknown as Record<string, unknown>
      )
    : ""

  // Helper function to update chunk state (reduces nesting complexity)
  const updateChunkState = useCallback(
    (chunkId: string, updates: Partial<AudioChunk>) => {
      setAudioChunks((prev) =>
        prev.map((c) => (c.id === chunkId ? { ...c, ...updates } : c))
      )
    },
    []
  )

  // Process sentences (combine short sentences with next ones)
  const processSentences = useCallback(
    async (sentences: string[]) => {
      if (sentences.length === 0) return

      console.log(`🔄 Processing ${sentences.length} sentences`)

      // Filter out already processed sentences
      const unprocessedSentences = sentences.filter(
        (sentence) => !processedSentencesRef.current.has(sentence)
      )

      if (unprocessedSentences.length === 0) return

      // 🔗 COMBINE SHORT SENTENCES: Group sentences until they meet minimum length
      const combinedSentences: string[] = []
      let currentCombined = ""

      for (let i = 0; i < unprocessedSentences.length; i++) {
        const sentence = unprocessedSentences[i].trim()

        if (currentCombined === "") {
          currentCombined = sentence
        } else {
          currentCombined += " " + sentence
        }

        // Check if we've reached minimum length OR if this is the last sentence
        const isLastSentence = i === unprocessedSentences.length - 1
        const meetsMinLength = currentCombined.length >= 28

        if (meetsMinLength || isLastSentence) {
          console.log(
            `🔗 Combined sentence (${
              currentCombined.length
            } chars): "${currentCombined.slice(0, 100)}${
              currentCombined.length > 100 ? "..." : ""
            }"`
          )
          combinedSentences.push(currentCombined)
          currentCombined = ""
        } else {
          console.log(
            `🔗 Adding to combination (${currentCombined.length} chars so far): "${sentence}"`
          )
        }
      }

      // Mark all original sentences as processed
      unprocessedSentences.forEach((sentence) => {
        processedSentencesRef.current.add(sentence)
      })

      // Process combined sentences in parallel for seamless audio
      const sentencePromises = combinedSentences.map(
        async (combinedSentence) => {
          const order = orderCounterRef.current++

          // Create tracking chunk
          const chunk: AudioChunk = {
            id: `${Date.now()}-${order}`,
            sentence: combinedSentence,
            order,
            audioUrl: null,
            isProcessing: true,
          }

          setAudioChunks((prev) => [...prev, chunk])

          // Generate TTS using locked speaker
          try {
            const lockedSpeaker = responseSpeakerRef.current || selectedSpeaker
            console.log(
              `🎤 Using locked speaker: ${lockedSpeaker} for sentence ${order}`
            )

            const audioUrl = await ttsGeneration.generateTTS(
              combinedSentence,
              lockedSpeaker
            )

            // Update chunk
            updateChunkState(chunk.id, { audioUrl: null, isProcessing: false }) // Add to playback queue if successful
            if (audioUrl) {
              const audio = ttsGeneration.createAudioFromUrl(audioUrl)
              audioPlayback.addToQueue(audio, order)
            }

            return { order, audioUrl }
          } catch (error) {
            console.error(`❌ TTS failed for order ${order}:`, error)

            updateChunkState(chunk.id, { audioUrl: null, isProcessing: false })
            return null
          }
        }
      )

      // Wait for all TTS generations to complete
      const results = await Promise.all(sentencePromises)
      const successCount = results.filter((r) => r?.audioUrl).length
      console.log(
        `✅ Completed ${successCount}/${results.length} TTS generations in parallel`
      )
    },
    [
      ttsGeneration,
      selectedSpeaker,
      audioPlayback,
      setAudioChunks,
      updateChunkState,
    ]
  )

  // Helper function to reset conversation state (reduces complexity)
  const resetConversationState = useCallback(
    (messageId: string) => {
      console.log("🔄 New conversation detected, resetting TTS state")

      processedSentencesRef.current.clear()
      lastProcessedTextLengthRef.current = 0
      orderCounterRef.current = 0
      conversationIdRef.current = messageId

      textChunking.clearBuffer()
      audioPlayback.resetPlayback()
      streamingBuffer.clearStreamingTimeout()

      setAudioChunks([])
    },
    [textChunking, audioPlayback, streamingBuffer]
  )

  // Main text processing effect
  useEffect(() => {
    if (!currentMessage || !currentText) {
      if (responseSpeakerRef.current) {
        console.log("🔓 Releasing speaker lock")
        responseSpeakerRef.current = null
      }
      return
    }

    // Handle new conversation
    if (currentMessage.id !== conversationIdRef.current) {
      resetConversationState(currentMessage.id)
    }

    // Lock speaker for this response
    if (!responseSpeakerRef.current) {
      responseSpeakerRef.current = selectedSpeaker
      console.log(`🔒 Speaker locked: ${selectedSpeaker}`)
    }

    // Process new text
    if (currentText.length > lastProcessedTextLengthRef.current) {
      const newText = currentText.slice(lastProcessedTextLengthRef.current)

      if (newText.length >= 5) {
        const { sentences } = textChunking.extractSentences(newText)
        if (sentences.length > 0) {
          processSentences(sentences)
        }

        lastProcessedTextLengthRef.current = currentText.length

        // Set timeout for buffer processing
        streamingBuffer.setStreamingTimeout(() => {
          const bufferContent = textChunking.getBuffer()
          const pendingContent = textChunking.getPendingSentence()

          // Try to process pending + buffer combination
          if (pendingContent && bufferContent) {
            const combined = pendingContent + " " + bufferContent
            if (combined.length >= 28) {
              console.log(`⏰ Processing pending + buffer: "${combined}"`)
              processSentences([combined.trim()])
              textChunking.clearBuffer() // This also clears pending
              return
            }
          }

          // Process buffer if long enough
          if (bufferContent.length >= 28 && chatStatus === "loading") {
            console.log(`⏰ Processing buffered text: "${bufferContent}"`)
            processSentences([bufferContent.trim()])
            textChunking.clearBuffer()
          } else if (bufferContent.length > 0 && chatStatus === "loading") {
            console.log(
              `⏰ Buffer too short (${bufferContent.length} chars), waiting: "${bufferContent}"`
            )
          }
        }, 1000) // Reduced timeout for faster processing
      }
    }

    // Handle completion
    if (chatStatus === "idle") {
      const remainingText = textChunking.getBuffer().trim()
      const pendingSentence = textChunking.getPendingSentence()

      // Combine remaining text with pending sentence if any
      let finalText = ""
      if (pendingSentence && remainingText) {
        finalText = pendingSentence + " " + remainingText
      } else if (pendingSentence) {
        finalText = pendingSentence
      } else if (remainingText) {
        finalText = remainingText
      }

      if (finalText && finalText.length >= 28) {
        console.log(`🏁 Processing final content: "${finalText}"`)
        processSentences([finalText])
        textChunking.clearBuffer()
      } else if (finalText && finalText.length > 0) {
        // Try to merge with previous chunk if final text is too short
        if (audioChunks.length > 0) {
          console.log(
            `🔗 Final text too short (${finalText.length} chars), merging with previous chunk: "${finalText}"`
          )

          // Get the last chunk and merge
          const lastChunk = audioChunks[audioChunks.length - 1]
          if (lastChunk?.sentence) {
            const mergedSentence = lastChunk.sentence + " " + finalText
            console.log(
              `🔗 Merged final sentence (${mergedSentence.length} chars): "${mergedSentence}"`
            )

            // Update the last chunk with merged sentence and re-generate TTS
            updateChunkState(lastChunk.id, { isProcessing: true })

            // Generate new TTS for merged sentence
            const lockedSpeaker = responseSpeakerRef.current || selectedSpeaker
            ttsGeneration
              .generateTTS(mergedSentence, lockedSpeaker)
              .then((audioUrl) => {
                updateChunkState(lastChunk.id, {
                  sentence: mergedSentence,
                  audioUrl,
                  isProcessing: false,
                })

                if (audioUrl) {
                  const audio = ttsGeneration.createAudioFromUrl(audioUrl)
                  audioPlayback.addToQueue(audio, lastChunk.order)
                }
              })
              .catch((error) => {
                console.error(`❌ TTS failed for merged sentence:`, error)
                updateChunkState(lastChunk.id, { isProcessing: false })
              })
          }
        } else {
          console.log(
            `🏁 Final content too short (${finalText.length} chars), skipping: "${finalText}"`
          )
        }
        textChunking.clearBuffer()
      }
    }

    return () => {
      streamingBuffer.clearStreamingTimeout()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentText,
    chatStatus,
    currentMessage,
    selectedSpeaker,
    textChunking,
    processSentences,
    audioPlayback,
    streamingBuffer,
    resetConversationState,
    // Note: audioChunks, ttsGeneration, updateChunkState are used inside
    // but shouldn't be dependencies as they would cause constant re-runs
  ])

  // Update synthesis status
  useEffect(() => {
    const isProcessing = audioChunks.some((chunk) => chunk.isProcessing)
    const playbackInfo = audioPlayback.getQueueInfo()
    const isBusy =
      isProcessing || playbackInfo.isPlaying || playbackInfo.hasQueuedAudio

    setIsSynthesizing(isBusy)

    // Schedule playback checks
    if (audioPlayback.canSchedulePlayback()) {
      audioPlayback.schedulePlaybackCheck()
    }
  }, [audioChunks, audioPlayback, setIsSynthesizing])

  // Cleanup effect for audio URLs and resources
  useEffect(() => {
    // Track audio URLs for cleanup using ttsGeneration hook's cleanup mechanism
    // The ttsGeneration hook already handles URL cleanup properly
    return () => {
      console.log("🧹 useAutoTTS cleanup completed")
    }
  }, []) // Empty dependency - cleanup only on unmount
}
