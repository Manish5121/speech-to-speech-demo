import { useCallback } from "react"

/**
 * Custom hook for extracting text content from various message formats
 * Handles different message structures from AI SDK and chat APIs
 */
export const useTextExtraction = () => {
  const extractTextFromMessage = useCallback(
    (message: Record<string, unknown>): string => {
      // Try parts array first (most common AI SDK format)
      if (Array.isArray(message.parts)) {
        const textParts = message.parts
          .filter((part: Record<string, unknown>) => part.type === "text")
          .map((part: Record<string, unknown>) => part.text as string)
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
          .filter((part: unknown) => {
            if (typeof part === "string") return true
            if (typeof part === "object" && part !== null) {
              const obj = part as Record<string, unknown>
              return obj.type === "text"
            }
            return false
          })
          .map((part: unknown) => {
            if (typeof part === "string") return part
            const obj = part as Record<string, unknown>
            return (obj.text as string) || (obj.content as string)
          })
          .filter(Boolean)

        if (textParts.length > 0) {
          return textParts.join(" ")
        }
      }

      return (message.text as string) || ""
    },
    []
  )

  return { extractTextFromMessage }
}
