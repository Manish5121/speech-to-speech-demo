"use client"

import { useState, useRef, useCallback } from "react"

interface UseVoiceRecorderProps {
  onTranscription: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
}

export function useVoiceRecorder({
  onTranscription,
  onError,
}: UseVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Convert WebM to 16kHz mono WAV
  const convertWebMToWAV = useCallback(
    async (webmBlob: Blob): Promise<Blob> => {
      const audioContext = new AudioContext()
      try {
        const arrayBuffer = await webmBlob.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        // Resample to 16kHz mono
        const targetSampleRate = 16000
        const targetChannels = 1
        const resampleRatio = targetSampleRate / audioBuffer.sampleRate
        const newLength = Math.floor(audioBuffer.length * resampleRatio)

        const offlineContext = new OfflineAudioContext(
          targetChannels,
          newLength,
          targetSampleRate
        )

        const source = offlineContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(offlineContext.destination)
        source.start(0)

        const resampledBuffer = await offlineContext.startRendering()
        const channelData = resampledBuffer.getChannelData(0)

        // Create WAV file
        const wavBuffer = createWAVBuffer(channelData, targetSampleRate)
        return new Blob([wavBuffer], { type: "audio/wav" })
      } finally {
        await audioContext.close()
      }
    },
    []
  )

  // Create WAV file buffer from audio data
  const createWAVBuffer = useCallback(
    (audioData: Float32Array, sampleRate: number): ArrayBuffer => {
      const length = audioData.length
      const buffer = new ArrayBuffer(44 + length * 2)
      const view = new DataView(buffer)

      // Helper to write string
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i))
        }
      }

      // WAV header
      writeString(0, "RIFF")
      view.setUint32(4, 36 + length * 2, true)
      writeString(8, "WAVE")
      writeString(12, "fmt ")
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true) // PCM
      view.setUint16(22, 1, true) // mono
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * 2, true)
      view.setUint16(32, 2, true)
      view.setUint16(34, 16, true)
      writeString(36, "data")
      view.setUint32(40, length * 2, true)

      // Convert to 16-bit PCM
      let offset = 44
      for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]))
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        view.setInt16(offset, intSample, true)
        offset += 2
      }

      return buffer
    },
    []
  )
  const startRecording = useCallback(async () => {
    try {
      console.log("🎤 Requesting microphone access...")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      console.log("🎤 Audio stream obtained, setting up MediaRecorder...")

      // Try to use WAV format if supported, otherwise fallback to WebM
      let mimeType = "audio/wav"
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm;codecs=opus"
        console.log("⚠️ WAV not supported, using WebM format")
      } else {
        console.log("✅ Using WAV format")
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        console.log("📊 Audio data chunk received:", event.data.size, "bytes")
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        console.log(
          "🛑 Recording stopped, processing",
          audioChunksRef.current.length,
          "chunks"
        )
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType,
        })
        console.log("📦 Original audio blob:", {
          size: audioBlob.size,
          type: audioBlob.type,
        })

        // Convert WebM to WAV if necessary
        let finalAudioBlob = audioBlob
        if (mimeType.includes("webm")) {
          console.log("🔄 Converting WebM to 16kHz WAV...")
          try {
            finalAudioBlob = await convertWebMToWAV(audioBlob)
            console.log("✅ Converted to WAV:", {
              size: finalAudioBlob.size,
              type: finalAudioBlob.type,
            })
          } catch (error) {
            console.error("❌ WebM conversion failed:", error)
            onError("Failed to convert audio format")
            return
          }
        }

        await transcribeAudio(finalAudioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      console.log("🔴 Recording started...")
    } catch (error) {
      console.error("Error starting recording:", error)
      onError("Could not access microphone. Please check permissions.")
    }
  }, [onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      console.log("🎤 Starting transcription process...")
      console.log("Audio blob details:", {
        size: audioBlob.size,
        type: audioBlob.type,
      })

      setIsTranscribing(true)

      try {
        const formData = new FormData()
        formData.append("audio", audioBlob)

        console.log("📤 Sending audio to /api/transcribe...")
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        })

        console.log("📥 API response received:", {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        })

        const result = await response.json()
        console.log("📋 API response data:", result)

        if (result.transcription) {
          console.log("✅ Transcription successful:", result.transcription)
          onTranscription(result.transcription, true)
        } else if (result.error) {
          console.log("❌ API returned error:", result.error)
          onError(result.error)
        } else {
          console.log("⚠️ No transcription or error in response:", result)
          onError("No transcription received from API")
        }
      } catch (error) {
        console.error("❌ Client-side transcription error:", error)
        onError("Error transcribing audio")
      } finally {
        setIsTranscribing(false)
      }
    },
    [onTranscription, onError]
  )

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
  }
}
