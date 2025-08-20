"use client"

import { useState, useRef, useCallback } from "react"

interface WisprMessage {
  status: "auth" | "text" | "error" | "info"
  position?: number
  final?: boolean
  body?: {
    text: string
    detected_language: string
  }
  message?: {
    event: string
  }
}

interface UseWisprWebSocketProps {
  apiKey: string
  onTranscription: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
}

export function useWisprWebSocket({
  apiKey,
  onTranscription,
  onError,
}: UseWisprWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Float32Array[]>([])
  const positionRef = useRef(0)
  const totalPacketsRef = useRef(0)

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Validate API key format
    if (!apiKey?.startsWith("fl-")) {
      onError("Invalid API key format. Wispr API keys should start with 'fl-'")
      return
    }

    try {
      // Try the direct API key endpoint first (simpler approach)
      const wsUrl = `wss://api.wisprflow.ai/api/v1/dash/ws?api_key=${apiKey}`
      console.log("Connecting to Wispr WebSocket with direct API key...")

      wsRef.current = new WebSocket(wsUrl)
    } catch (error) {
      console.error("Failed to create WebSocket:", error)
      onError(
        `Authentication failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
      return
    }

    wsRef.current.onopen = () => {
      console.log("Wispr WebSocket connected successfully")
      setIsConnected(true)

      // Send authentication message according to the docs
      const authMessage = {
        type: "auth",
        access_token: apiKey,
        language: ["en"],
        context: {
          app: {
            name: "Voice Agent",
            type: "ai",
          },
          dictionary_context: [],
          user_identifier: "voice_agent_user",
          user_first_name: "",
          user_last_name: "",
          textbox_contents: {
            before_text: "",
            selected_text: "",
            after_text: "",
          },
          screenshot: null,
          content_text: null,
          content_html: null,
          conversation: null,
        },
      }

      console.log("Sending auth message")
      wsRef.current?.send(JSON.stringify(authMessage))
    }

    wsRef.current.onmessage = (event) => {
      console.log("Received WebSocket message:", event.data)
      const response: WisprMessage = JSON.parse(event.data)

      if (response.status === "auth") {
        console.log("WebSocket authenticated successfully")
      } else if (response.status === "text") {
        console.log(
          "Received transcription:",
          response.body?.text,
          "Final:",
          response.final
        )
        if (response.body?.text) {
          onTranscription(response.body.text, response.final || false)
        }
      } else if (response.status === "error") {
        console.error("Wispr transcription error:", response)
        onError("Transcription error occurred")
      } else if (response.status === "info") {
        console.log("Info message:", response.message)
      }
    }

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error)
      onError(
        "WebSocket connection failed - check your API key and network connection"
      )
    }

    wsRef.current.onclose = (event) => {
      console.log(
        "WebSocket closed with code:",
        event.code,
        "reason:",
        event.reason
      )
      setIsConnected(false)
      setIsTranscribing(false)

      // Provide more specific error message based on close code
      if (event.code === 1006) {
        onError("Connection failed - check your API key and network")
      } else if (event.code === 1000) {
        console.log("WebSocket closed normally")
      } else {
        onError(`WebSocket closed unexpectedly (code: ${event.code})`)
      }
    }
  }, [apiKey, onTranscription, onError])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setIsTranscribing(false)
  }, [])

  const startTranscription = useCallback(async () => {
    if (!isConnected || !wsRef.current) {
      onError("WebSocket not connected")
      return
    }

    try {
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 })

      // Use MediaRecorder for simpler audio capture
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      positionRef.current = 0
      totalPacketsRef.current = 0
      setIsTranscribing(true)

      let chunkIndex = 0
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Convert audio blob to the format Wispr expects
          const arrayBuffer = await event.data.arrayBuffer()
          const audioContext = new AudioContext({ sampleRate: 16000 })
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

          // Get audio data as Float32Array
          const audioData = audioBuffer.getChannelData(0)

          // Convert to Int16Array for Wispr
          const int16Array = new Int16Array(audioData.length)
          for (let i = 0; i < audioData.length; i++) {
            int16Array[i] = Math.max(
              -32768,
              Math.min(32767, audioData[i] * 32767)
            )
          }

          // Convert to base64
          const buffer = new ArrayBuffer(int16Array.length * 2)
          const view = new DataView(buffer)
          for (let i = 0; i < int16Array.length; i++) {
            view.setInt16(i * 2, int16Array[i], true)
          }

          const base64Audio = btoa(
            String.fromCharCode(...new Uint8Array(buffer))
          )

          // Send audio chunk
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "append",
                position: positionRef.current,
                audio_packets: {
                  packets: [base64Audio],
                  volumes: [1.0],
                  packet_duration: audioData.length / 16000,
                  audio_encoding: "wav",
                  byte_encoding: "base64",
                },
              })
            )

            positionRef.current += 1
            totalPacketsRef.current += 1
          }
        }
      }

      // Record in small chunks for real-time processing
      mediaRecorder.start(1000) // 1 second chunks
    } catch (error) {
      console.error("Error starting transcription:", error)
      onError("Could not access microphone")
    }
  }, [isConnected, onError])

  const stopTranscription = useCallback(() => {
    setIsTranscribing(false)

    // Stop media recorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop()
    }

    // Stop audio processing
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop media stream tracks
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track: MediaStreamTrack) => track.stop())
    }

    // Send commit message
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "commit",
          total_packets: totalPacketsRef.current,
        })
      )
    }
  }, [])

  return {
    isConnected,
    isTranscribing,
    connect,
    disconnect,
    startTranscription,
    stopTranscription,
  }
}
