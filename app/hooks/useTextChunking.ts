import { useCallback, useRef } from "react"

interface ChunkingResult {
  sentences: string[]
  bufferUpdated: boolean
}

/**
 * 🔤 Text Chunking Hook
 *
 * Handles intelligent text parsing and sentence extraction:
 * - Real-time text buffering and processing
 * - Smart sentence boundary detection
 * - Natural phrase break identification
 * - Streaming-optimized chunking
 *
 * NOTE: This hook uses direct ref mutations during processing, which is an
 * acceptable React pattern for refs (they don't trigger re-renders). The
 * mutations happen inside useCallback functions and don't cause side effects.
 */
export function useTextChunking() {
  const sentenceBufferRef = useRef("")
  const pendingShortSentenceRef = useRef("")

  // Extract complete sentences from streaming text
  const extractSentences = useCallback((text: string): ChunkingResult => {
    if (!text.trim()) return { sentences: [], bufferUpdated: false }

    // Build complete text with buffer
    const fullText = sentenceBufferRef.current + text
    const sentences: string[] = []

    console.log(
      `🔍 Processing: "${fullText.slice(0, 80)}..." (${fullText.length} chars)`
    )

    // 🎯 IMPROVED: Wait for complete sentences, don't cut at arbitrary lengths
    const strongBoundaries = fullText.split(/([.!?]+(?:\s+|$))/)
    let currentChunk = ""

    for (const part of strongBoundaries) {
      currentChunk += part

      if (/[.!?]+(?:\s+|$)/.test(part)) {
        // Complete sentence found
        const chunk = currentChunk.trim()

        // ✅ ALWAYS DETECT COMPLETE SENTENCES - but check length before processing
        if (chunk.length >= 10) {
          // Sanity check for very tiny sentences
          console.log(
            `✅ Complete sentence (${chunk.length} chars): "${chunk}"`
          )

          if (chunk.length >= 28) {
            // ✅ COMPLETE SENTENCE MEETS MINIMUM - Process immediately
            if (pendingShortSentenceRef.current) {
              const combined = pendingShortSentenceRef.current + " " + chunk
              console.log(
                `🔗 Combined with pending (${combined.length} chars): "${combined}"`
              )
              sentences.push(combined)
              pendingShortSentenceRef.current = ""
            } else {
              sentences.push(chunk)
            }
            currentChunk = ""
          } else {
            // ✅ COMPLETE SENTENCE TOO SHORT - Store and wait for next to merge
            console.log(
              `📝 Complete but short sentence (${chunk.length} chars), storing for merging: "${chunk}"`
            )

            if (pendingShortSentenceRef.current) {
              // Combine with existing pending sentence
              pendingShortSentenceRef.current += " " + chunk
              console.log(
                `🔗 Building combined sentence (${pendingShortSentenceRef.current.length} chars): "${pendingShortSentenceRef.current}"`
              )

              // If combined sentence is now long enough, process it
              if (pendingShortSentenceRef.current.length >= 28) {
                sentences.push(pendingShortSentenceRef.current)
                pendingShortSentenceRef.current = ""
              }
            } else {
              // Store this short complete sentence to merge with next
              pendingShortSentenceRef.current = chunk
            }
            currentChunk = ""
          }
        } else {
          // Very short complete sentence - always store for combination
          console.log(
            `⚠️ Very short sentence (${chunk.length} chars), storing for combination: "${chunk}"`
          )
          if (pendingShortSentenceRef.current) {
            pendingShortSentenceRef.current += " " + chunk
          } else {
            pendingShortSentenceRef.current = chunk
          }
          currentChunk = ""
        }
      }
    }

    // ✅ COMPLETE SENTENCES ONLY: Check pending + ongoing text
    if (
      pendingShortSentenceRef.current &&
      currentChunk.length > 0 &&
      sentences.length === 0
    ) {
      const combined =
        pendingShortSentenceRef.current + " " + currentChunk.trim()

      // ✅ ONLY PROCESS COMPLETE SENTENCES WITH MINIMUM LENGTH
      const hasCompleteEnd = /[.!?]\s*$/.test(combined.trim())
      const meetsMinimum = combined.length >= 28

      if (hasCompleteEnd && meetsMinimum) {
        console.log(
          `🚀 Processing pending + ongoing complete sentence (${combined.length} chars): "${combined}"`
        )
        sentences.push(combined)
        pendingShortSentenceRef.current = ""
        currentChunk = ""
      }
    }

    // ✅ NO COMMA/CONJUNCTION BREAKING - WAIT FOR COMPLETE SENTENCES ONLY

    // Handle any remaining pending short sentence with incomplete chunk
    if (pendingShortSentenceRef.current && currentChunk.length > 0) {
      const combined =
        pendingShortSentenceRef.current + " " + currentChunk.trim()

      // ✅ ONLY PROCESS COMPLETE SENTENCES WITH MINIMUM LENGTH
      const hasCompleteEnd = /[.!?]\s*$/.test(combined.trim())
      const meetsMinimum = combined.length >= 28

      if (hasCompleteEnd && meetsMinimum) {
        console.log(
          `🔗 Final complete sentence combination (${combined.length} chars): "${combined}"`
        )
        sentences.push(combined)
        pendingShortSentenceRef.current = ""
        currentChunk = ""
      }
    } else if (pendingShortSentenceRef.current) {
      // If we have a pending sentence but no more content, keep it in buffer for next time
      currentChunk = pendingShortSentenceRef.current + " " + currentChunk
      pendingShortSentenceRef.current = ""
    }

    // Update buffer with incomplete chunk
    const previousBuffer = sentenceBufferRef.current
    sentenceBufferRef.current = currentChunk
    const bufferUpdated = previousBuffer !== currentChunk

    if (sentences.length > 0) {
      console.log(`🎯 Extracted ${sentences.length} chunks for TTS`)
    }

    return { sentences, bufferUpdated }
  }, [])

  const getBuffer = useCallback(() => sentenceBufferRef.current, [])

  const clearBuffer = useCallback(() => {
    sentenceBufferRef.current = ""
    pendingShortSentenceRef.current = ""
    console.log("🧹 Buffer and pending sentences cleared")
  }, [])

  const getBufferLength = useCallback(
    () => sentenceBufferRef.current.length,
    []
  )

  const getPendingSentence = useCallback(
    () => pendingShortSentenceRef.current,
    []
  )

  const clearPendingSentence = useCallback(() => {
    pendingShortSentenceRef.current = ""
    console.log("🧹 Pending sentence cleared")
  }, [])

  // New function to merge final short sentence with previous chunk
  const mergeWithPreviousChunk = useCallback(
    (sentences: string[], finalText: string): string[] => {
      if (!finalText || finalText.length >= 28 || sentences.length === 0) {
        // Don't merge if final text is empty, long enough, or no previous chunks
        return sentences
      }

      console.log(
        `🔗 Final text too short (${finalText.length} chars), merging with previous chunk: "${finalText}"`
      )

      // Get the last sentence and merge with final text
      const modifiedSentences = [...sentences]
      const lastSentence = modifiedSentences.pop()

      if (lastSentence) {
        const mergedSentence = lastSentence + " " + finalText
        modifiedSentences.push(mergedSentence)
        console.log(
          `🔗 Merged sentence (${mergedSentence.length} chars): "${mergedSentence}"`
        )
      } else {
        // Fallback: add final text as is if no previous sentence
        modifiedSentences.push(finalText)
      }

      return modifiedSentences
    },
    []
  )

  return {
    extractSentences,
    getBuffer,
    clearBuffer,
    getBufferLength,
    getPendingSentence,
    clearPendingSentence,
    mergeWithPreviousChunk,
  }
}
