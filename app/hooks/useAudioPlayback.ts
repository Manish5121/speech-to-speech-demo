import { useCallback, useRef, useState } from "react"

/**
 * 🔊 AUDIO PLAYBACK HOOK
 *
 * Extracted from useAutoTTS - handles sequential audio playback
 * - Manages ordered audio queue with strict sequencing
 * - Handles audio element lifecycle and cleanup
 * - Provides playback state management
 * - Ensures seamless audio transitions
 */

interface QueuedAudio {
  audio: HTMLAudioElement
  order: number
}

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false)

  const audioQueueRef = useRef<QueuedAudio[]>([])
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const nextExpectedOrderRef = useRef(0)
  const playbackScheduledRef = useRef(false)

  // Sequential audio playback - strict order enforcement (copied from useAutoTTS)
  const playNextInQueue = useCallback(async (): Promise<void> => {
    if (isPlaying) return

    // Find the next audio chunk that should play based on nextExpectedOrder
    const nextExpectedOrder = nextExpectedOrderRef.current
    const nextAudioIndex = audioQueueRef.current.findIndex(
      (item) => item.order === nextExpectedOrder
    )

    console.log(
      `� Looking for chunk ${nextExpectedOrder} (queue: ${audioQueueRef.current.length} items)`
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

    console.log(`� Playing chunk ${order}`)

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

  // Add audio to playback queue
  const addToQueue = useCallback(
    (audio: HTMLAudioElement, order: number) => {
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
    },
    [isPlaying, playNextInQueue]
  )

  // Remove audio from queue by order
  const removeFromQueue = useCallback((order: number) => {
    const queueIndex = audioQueueRef.current.findIndex(
      (item) => item.order === order
    )
    if (queueIndex !== -1) {
      console.log(`🚫 Removing audio chunk ${order} from queue`)
      audioQueueRef.current.splice(queueIndex, 1)
      return true
    }
    return false
  }, [])

  // Stop current playback
  const stopPlayback = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setIsPlaying(false)
    playbackScheduledRef.current = false
    console.log("⏹️ Playback stopped")
  }, [])

  // Clear entire queue
  const clearQueue = useCallback(() => {
    audioQueueRef.current = []
    console.log("🗑️ Audio queue cleared")
  }, [])

  // Reset playback state for new conversation
  const resetPlayback = useCallback(() => {
    stopPlayback()
    clearQueue()
    nextExpectedOrderRef.current = 0
    console.log("🔄 Playback state reset")
  }, [stopPlayback, clearQueue])

  // Get queue information
  const getQueueInfo = useCallback(() => {
    return {
      queueLength: audioQueueRef.current.length,
      nextExpectedOrder: nextExpectedOrderRef.current,
      isPlaying,
      hasQueuedAudio: audioQueueRef.current.length > 0,
    }
  }, [isPlaying])

  // Check if can schedule playback
  const canSchedulePlayback = useCallback(() => {
    return (
      !isPlaying &&
      !currentAudioRef.current &&
      !playbackScheduledRef.current &&
      audioQueueRef.current.length > 0
    )
  }, [isPlaying])

  // Schedule playback check
  const schedulePlaybackCheck = useCallback(() => {
    if (canSchedulePlayback()) {
      playbackScheduledRef.current = true
      console.log(`📅 Scheduling periodic check for next audio`)
      setTimeout(() => {
        playNextInQueue()
      }, 100)
    }
  }, [canSchedulePlayback, playNextInQueue])

  return {
    // State
    isPlaying,

    // Queue management
    addToQueue,
    removeFromQueue,
    clearQueue,

    // Playback control
    playNextInQueue,
    stopPlayback,
    resetPlayback,

    // Status
    getQueueInfo,
    canSchedulePlayback,
    schedulePlaybackCheck,

    // Refs (for advanced usage)
    playbackScheduledRef,
  }
}
