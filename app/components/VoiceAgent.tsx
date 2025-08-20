"use client"

import { useState, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Volume2 } from "lucide-react"
import { useVoiceRecorder } from "../hooks/useVoiceRecorder"
import PulsingOrb from "./PulsingOrb"

export default function VoiceAgent() {
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [transcription, setTranscription] = useState("")
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<
    string | null
  >(null)

  const chatHelpers = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    onFinish: (message) => {
      // Message finished - TTS will be triggered by useEffect
    },
    onError: (error) => {
      console.error("Chat error:", error)
    },
  })

  const { messages, sendMessage, status } = chatHelpers

  const voiceRecorder = useVoiceRecorder({
    onTranscription: (text: string, isFinal: boolean) => {
      if (isFinal) {
        setTranscription(text)
        if (text.trim()) {
          sendMessage({ text })
        }
      }
    },
    onError: (error: string) => {
      console.error("Voice recording error:", error)
      setTranscription(`Error: ${error}`)
    },
  })

  const handleRecordingToggle = () => {
    if (voiceRecorder.isRecording) {
      voiceRecorder.stopRecording()
    } else {
      setTranscription("")
      voiceRecorder.startRecording()
    }
  }

  const synthesizeSpeech = async (text: string) => {
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
  }

  // Extract text content from various message formats
  const extractTextFromMessage = (message: any): string => {
    // Try parts array first (most common AI SDK format)
    if (Array.isArray(message.parts)) {
      const textParts = message.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .filter(Boolean)

      if (textParts.length > 0) {
        return textParts.join(" ")
      }
    }

    // Try direct content property
    if (typeof message.content === "string") {
      return message.content
    }

    // Try content array
    if (Array.isArray(message.content)) {
      const textParts = message.content
        .filter((part: any) => part.type === "text" || typeof part === "string")
        .map((part: any) =>
          typeof part === "string" ? part : part.text || part.content
        )
        .filter(Boolean)

      if (textParts.length > 0) {
        return textParts.join(" ")
      }
    }

    return message.text || ""
  }

  // Auto-synthesize the latest assistant message using useEffect
  useEffect(() => {
    const latestMessage = messages[messages.length - 1]

    // Only trigger TTS for new assistant messages
    if (
      latestMessage &&
      latestMessage.role === "assistant" &&
      latestMessage.id !== lastProcessedMessageId &&
      !isSynthesizing &&
      status !== "streaming"
    ) {
      const textContent = extractTextFromMessage(latestMessage)

      if (textContent?.trim()) {
        setLastProcessedMessageId(latestMessage.id)
        // Immediate TTS - no delay
        synthesizeSpeech(textContent.trim())
      }
    }
  }, [messages, status, isSynthesizing, lastProcessedMessageId])

  // Get status message based on current state
  const getStatusMessage = () => {
    if (voiceRecorder.isRecording) return "Recording... Click to stop"
    if (voiceRecorder.isTranscribing) return "Transcribing audio..."
    if (status === "streaming") return "AI is thinking..."
    if (isSynthesizing) return "Playing response..."
    return "Click to start recording"
  }

  return (
    <div className="main-container">
      <div className="flex flex-col gap-8 py-12 min-h-screen">
        {/* Header Section */}
        <div className="text-left px-4 sm:px-8">
          <h1 className="text-2xl sm:text-2xl italic text-blue-900/80 mb-2">
            Voice Agent
          </h1>
          <p className="text-base sm:text-md text-gray-600  max-w-3xl mx-auto leading-relaxed">
            Have a natural conversation with AI using your voice
          </p>
        </div>

        <div className="relative h-6 border-y">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, #e4e4e7 0 1px, transparent 1px 10px)",
              opacity: 1,
            }}
          />
        </div>

        {/* Conversation Section - Now First */}
        <div className="px-4 sm:px-8 flex-1">
          <h2 className="text-md sm:text-md italic text-blue-900/80 mb-6 text-left">
            Conversation
          </h2>

          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto text-center py-8">
              <p className="text-gray-500/80 text-sm sm:text-base leading-relaxed">
                Start a conversation by recording your voice
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto h-96 overflow-y-auto border rounded-lg bg-gray-50 p-4">
              <div className="space-y-4">
                {messages.map((message: any) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`
                        max-w-xs lg:max-w-md px-4 py-3 rounded-lg
                        ${
                          message.role === "user"
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-900 border shadow-sm"
                        }
                      `}
                    >
                      <p className="text-sm">
                        {extractTextFromMessage(message) || "No text content"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative h-6 border-y">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, #e4e4e7 0 1px, transparent 1px 10px)",
              opacity: 1,
            }}
          />
        </div>

        {/* Voice Recording Section - Now Second */}
        <div className="text-center px-4 sm:px-8 relative">
          <div className="mb-4 relative flex justify-center">
            <PulsingOrb
              isRecording={voiceRecorder.isRecording}
              onToggleRecording={handleRecordingToggle}
              disabled={voiceRecorder.isTranscribing || status === "streaming"}
            />
          </div>

          <p className="text-gray-500 text-sm sm:text-base mb-2">
            {getStatusMessage()}
          </p>

          {/* Status Indicators */}
          {isSynthesizing && (
            <div className="flex items-center justify-center gap-2 text-purple-600 mb-2">
              <Volume2 className="w-4 h-4" />
              <p className="text-sm">Playing response...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
