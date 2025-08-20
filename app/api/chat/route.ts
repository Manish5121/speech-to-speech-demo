import { openai } from "@ai-sdk/openai"
import { streamText, convertToModelMessages } from "ai"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    console.log("=== Chat API Called ===")
    console.log("📥 Received messages:", JSON.stringify(messages, null, 2))

    // Convert UI messages to model messages format
    const modelMessages = convertToModelMessages(messages)

    console.log(
      "🔄 Converted to model messages:",
      JSON.stringify(modelMessages, null, 2)
    )

    const result = streamText({
      model: openai("gpt-4"),
      messages: modelMessages,
      system: `You are a helpful voice assistant. Keep your responses conversational and concise, as they will be read aloud. Avoid using formatting like bullet points or numbered lists. Speak naturally as if you're having a conversation.`,
    })

    console.log("✅ OpenAI API call successful, streaming response...")

    // Log the response after it's generated (async)
    result.text
      .then((fullText) => {
        console.log("🤖 Complete OpenAI response:", fullText)
      })
      .catch(console.error)

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("❌ Chat API error:", error)
    return new Response("Error processing request", { status: 500 })
  }
}
