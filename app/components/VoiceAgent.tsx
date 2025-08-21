"use client"

import { useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useVoiceRecorder } from "@/app/hooks/useVoiceRecorder"
import { useSpeechSynthesis } from "@/app/hooks/useSpeechSynthesis"
import { useAutoTTS } from "@/app/hooks/useAutoTTS"
import ConversationDisplay from "@/app/components/ConversationDisplay"
import VoiceRecordingInterface from "@/app/components/VoiceRecordingInterface"
import SectionDivider from "@/app/components/SectionDivider"

export default function VoiceAgent() {
  // Chat functionality
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    onFinish: () => {
      // Message finished - TTS will be triggered by useAutoTTS hook
    },
    onError: (error) => {
      console.error("Chat error:", error)
    },
  })

  // Speech synthesis
  const { isSynthesizing } = useSpeechSynthesis()

  // Auto TTS for assistant responses
  useAutoTTS({
    messages,
    chatStatus: status === "streaming" ? "loading" : "idle",
    setIsSynthesizing: () => {}, // This hook manages its own state
  })

  // Voice recording with callbacks
  const voiceRecorder = useVoiceRecorder({
    onTranscription: useCallback(
      (text: string, isFinal: boolean) => {
        if (isFinal) {
          if (text.trim()) {
            sendMessage({ text })
          }
        }
      },
      [sendMessage]
    ),
    onError: useCallback((error: string) => {
      console.error("Voice recording error:", error)
    }, []),
  })

  // Recording toggle handler
  const handleRecordingToggle = useCallback(() => {
    if (voiceRecorder.isRecording) {
      voiceRecorder.stopRecording()
    } else {
      voiceRecorder.startRecording()
    }
  }, [voiceRecorder])

  return (
    <div className="main-container">
      <div className="flex flex-col gap-8 py-12 min-h-screen">
        {/* Header Section */}
        <header className="text-left px-4 sm:px-8">
          <h1 className="text-2xl sm:text-2xl italic text-blue-900/80 mb-2">
            Voice Agent
          </h1>
          <p className="text-base sm:text-md text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Have a natural conversation with AI using your voice
          </p>
        </header>

        <SectionDivider />

        {/* Conversation Section */}
        <section className="px-4 sm:px-8 flex-1">
          <h2 className="text-md sm:text-md italic text-blue-900/80 mb-6 text-left">
            Conversation
          </h2>
          <ConversationDisplay messages={messages} />
        </section>

        <SectionDivider />

        {/* Voice Recording Section */}
        <section>
          <VoiceRecordingInterface
            isRecording={voiceRecorder.isRecording}
            isTranscribing={voiceRecorder.isTranscribing}
            isSynthesizing={isSynthesizing}
            chatStatus={status}
            onToggleRecording={handleRecordingToggle}
            disabled={voiceRecorder.isTranscribing || status === "streaming"}
          />
        </section>
      </div>
    </div>
  )
}
