import { UIMessage } from "ai"
import { useTextExtraction } from "@/app/hooks/useTextExtraction"

interface ConversationDisplayProps {
  readonly messages: UIMessage[]
}

/**
 * Component responsible for displaying the conversation history
 * Shows messages in a scrollable container with proper styling
 */
export default function ConversationDisplay({
  messages,
}: ConversationDisplayProps) {
  const { extractTextFromMessage } = useTextExtraction()

  if (messages.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-8">
        <p className="text-gray-500/80 text-sm sm:text-base leading-relaxed">
          Start a conversation by recording your voice
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto h-96 overflow-y-auto border rounded-lg bg-gray-50 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
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
                {extractTextFromMessage(
                  message as unknown as Record<string, unknown>
                ) || "No text content"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
