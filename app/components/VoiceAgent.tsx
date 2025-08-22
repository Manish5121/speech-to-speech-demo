"use client"

import { useCallback, useEffect, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useVoiceRecorder } from "@/app/hooks/useVoiceRecorder"
import { useSpeechSynthesis } from "@/app/hooks/useSpeechSynthesis"
import { useAutoTTS } from "@/app/hooks/useAutoTTS-refactored"
import { useTextExtraction } from "@/app/hooks/useTextExtraction"
import ConversationDisplay from "@/app/components/ConversationDisplay"
import VoiceRecordingInterface from "@/app/components/VoiceRecordingInterface"
import SectionDivider from "@/app/components/SectionDivider"
import SpeakerSelector from "@/app/components/SpeakerSelector"

export default function VoiceAgent() {
  const { extractTextFromMessage } = useTextExtraction()

  // Speaker selection state
  const [selectedSpeaker, setSelectedSpeaker] = useState("vinaya_assist")

  // Chat functionality
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    onFinish: () => {
      console.log("✅ Chat finished")
    },
    onError: (error) => {
      console.error("Chat error:", error)
    },
  })

  // Debug chat status changes
  useEffect(() => {
    console.log(`🔄 Chat status changed: ${status}`)
  }, [status])

  // Debug message changes
  useEffect(() => {
    console.log(`📝 Messages updated: ${messages.length} total`)
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      const content = extractTextFromMessage(
        lastMessage as unknown as Record<string, unknown>
      )
      console.log(
        `📝 Last message (${lastMessage.role}): "${content?.slice(0, 100)}..."`
      )
    }
  }, [messages, extractTextFromMessage])

  // Speech synthesis (for tracking overall synthesis state)
  const { isSynthesizing, setIsSynthesizing } = useSpeechSynthesis()

  // Auto TTS for assistant responses
  useAutoTTS({
    messages,
    chatStatus: status === "streaming" ? "loading" : "idle",
    setIsSynthesizing,
    selectedSpeaker,
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

        {/* Speaker Selection Section */}
        <section className="px-4 sm:px-8">
          <h2 className="text-md sm:text-md italic text-blue-900/80 mb-4 text-left">
            Voice Settings
          </h2>
          <div className="max-w-md">
            <SpeakerSelector
              selectedSpeaker={selectedSpeaker}
              onSpeakerChange={setSelectedSpeaker}
              disabled={
                voiceRecorder.isRecording ||
                status === "streaming" ||
                isSynthesizing
                // Removed: messages.length > 0 (allow changes between responses)
              }
            />
          </div>
        </section>

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
