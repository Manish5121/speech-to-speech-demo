"use client"

import { useState, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react"
import { useVoiceRecorder } from "../hooks/useVoiceRecorder"

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
      console.log("✅ Chat finished, assistant message added:", message)
      console.log("💬 All messages after finish:", chatHelpers.messages)
    },
    onError: (error) => {
      console.error("❌ Chat error:", error)
    },
  })

  const { messages, sendMessage, status } = chatHelpers

  const voiceRecorder = useVoiceRecorder({
    onTranscription: (text: string, isFinal: boolean) => {
      if (isFinal) {
        setTranscription(text)
        if (text.trim()) {
          console.log("🗣️ Sending message to chat:", text)
          console.log("📊 Current messages before send:", messages)
          console.log("📱 Chat status before send:", status)
          sendMessage({ text })
          console.log("📤 sendMessage called successfully")
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
    console.log("🔊 Starting TTS for text:", text)
    setIsSynthesizing(true)

    try {
      console.log("📤 Calling /api/synthesize...")
      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      console.log("📥 TTS API response:", response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ TTS API error:", errorText)
        throw new Error(
          `TTS API error: ${response.status} ${response.statusText}`
        )
      }

      const result = await response.json()
      console.log("🎵 TTS result:", result)

      if (result.audio_data) {
        console.log("▶️ Playing base64 audio...")
        // Handle base64 audio data
        const audioBlob = new Blob(
          [Uint8Array.from(atob(result.audio_data), (c) => c.charCodeAt(0))],
          { type: result.content_type || "audio/wav" }
        )

        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audio.onloadeddata = () => {
          console.log("✅ Audio loaded successfully")
        }

        audio.onended = () => {
          console.log("🔇 Audio playback finished")
          URL.revokeObjectURL(audioUrl)
        }

        audio.onerror = (error) => {
          console.error("❌ Audio playback error:", error)
        }

        await audio.play()
        console.log("✅ Audio started playing")
      } else if (result.audio_url) {
        console.log("▶️ Playing audio from URL:", result.audio_url)
        // Handle audio URL
        const audio = new Audio(result.audio_url)

        audio.onended = () => {
          console.log("🔇 Audio playback finished")
        }

        audio.onerror = (error) => {
          console.error("❌ Audio playback error:", error)
        }

        await audio.play()
        console.log("✅ Audio started playing")
      } else {
        console.log("⚠️ No audio data in TTS response:", result.message)
      }
    } catch (error) {
      console.error("❌ Speech synthesis error:", error)
    } finally {
      setIsSynthesizing(false)
    }
  }

  // Extract text content from various message formats
  const extractTextFromMessage = (message: any): string => {
    console.log("🔍 Extracting text from message:", message)

    // Method 1: Direct content property (string)
    if (typeof message.content === "string") {
      console.log("📝 Found direct string content:", message.content)
      return message.content
    }

    // Method 2: Content array with text parts
    if (Array.isArray(message.content)) {
      const textParts = message.content
        .filter((part: any) => part.type === "text" || typeof part === "string")
        .map((part: any) =>
          typeof part === "string" ? part : part.text || part.content
        )
        .filter(Boolean)

      if (textParts.length > 0) {
        const text = textParts.join(" ")
        console.log("📝 Found content array text:", text)
        return text
      }
    }

    // Method 3: Parts array (AI SDK format)
    if (Array.isArray(message.parts)) {
      const textParts = message.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .filter(Boolean)

      if (textParts.length > 0) {
        const text = textParts.join(" ")
        console.log("📝 Found parts array text:", text)
        return text
      }
    }

    // Method 4: Direct text property
    if (message.text) {
      console.log("📝 Found direct text property:", message.text)
      return message.text
    }

    // Method 5: Look for any text-like property
    const textKeys = ["text", "message", "body", "response"]
    for (const key of textKeys) {
      if (message[key] && typeof message[key] === "string") {
        console.log(`📝 Found text in ${key} property:`, message[key])
        return message[key]
      }
    }

    console.log("❌ No text content found in message")
    return ""
  }

  // Auto-synthesize the latest assistant message using useEffect
  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    console.log("=== TTS Trigger Check ===")
    console.log("📝 Latest message:", latestMessage)
    console.log("📊 Messages count:", messages.length)
    console.log("🔄 Status:", status)
    console.log("🔊 Is synthesizing:", isSynthesizing)
    console.log("🆔 Last processed:", lastProcessedMessageId)

    // Only trigger TTS for new assistant messages
    if (
      latestMessage &&
      latestMessage.role === "assistant" &&
      latestMessage.id !== lastProcessedMessageId &&
      !isSynthesizing &&
      status !== "streaming"
    ) {
      console.log("✅ New assistant message detected!")

      const textContent = extractTextFromMessage(latestMessage)

      console.log("🔍 Final extracted text content:", textContent)

      if (textContent && textContent.trim()) {
        console.log("🚀 Triggering TTS...")
        setLastProcessedMessageId(latestMessage.id)

        // Add a small delay to ensure streaming is complete
        setTimeout(() => {
          synthesizeSpeech(textContent.trim())
        }, 500)
      } else {
        console.log("❌ No text content found in message structure")
        console.log("📋 Message keys:", Object.keys(latestMessage))
        console.log("📄 Full message:", JSON.stringify(latestMessage, null, 2))
      }
    } else {
      console.log("❌ TTS conditions not met:")
      if (!latestMessage) console.log("   - No latest message")
      if (latestMessage && latestMessage.role !== "assistant")
        console.log(
          "   - Latest message is not from assistant, role:",
          latestMessage.role
        )
      if (latestMessage && latestMessage.id === lastProcessedMessageId)
        console.log("   - Message already processed")
      if (isSynthesizing) console.log("   - Already synthesizing")
      if (status === "streaming") console.log("   - Still streaming")
    }
  }, [messages, status, isSynthesizing, lastProcessedMessageId])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Voice Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
        <div className="text-center">
          <div className="mb-6">
            <button
              onClick={handleRecordingToggle}
              disabled={voiceRecorder.isTranscribing || status === "streaming"}
              className={`
                w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200
                ${
                  voiceRecorder.isRecording
                    ? "bg-red-500 hover:bg-red-600 scale-110"
                    : "bg-blue-500 hover:bg-blue-600"
                }
                text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {(() => {
                if (voiceRecorder.isTranscribing)
                  return <Loader2 className="w-8 h-8 animate-spin" />
                if (voiceRecorder.isRecording)
                  return <MicOff className="w-8 h-8" />
                return <Mic className="w-8 h-8" />
              })()}
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {voiceRecorder.isRecording
              ? "Recording... Click to stop"
              : "Click to start recording"}
          </p>

          {voiceRecorder.isTranscribing && (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Transcribing audio...
            </p>
          )}

          {status === "streaming" && (
            <p className="text-sm text-green-600 dark:text-green-400">
              AI is thinking...
            </p>
          )}

          {isSynthesizing && (
            <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400">
              <Volume2 className="w-4 h-4" />
              <p className="text-sm">Playing response...</p>
            </div>
          )}
        </div>

        {/* Transcription Display */}
        {transcription && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
              You said:
            </p>
            <p className="text-gray-900 dark:text-white">{transcription}</p>
          </div>
        )}
      </div>

      {/* Conversation Display */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Conversation
        </h2>

        {messages.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Start a conversation by recording your voice
          </p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {messages.map((message: any) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`
                    max-w-xs lg:max-w-md px-4 py-2 rounded-lg
                    ${
                      message.role === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
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
        )}
      </div>
    </div>
  )
}
