// Streaming TTS API endpoint - handles real-time audio generation
export async function POST(req: Request) {
  try {
    // Handle empty or malformed requests
    let body
    let text

    try {
      const requestText = await req.text()
      if (!requestText || requestText.trim() === "") {
        console.log("⚠️ Empty request body received")
        return new Response(JSON.stringify({ error: "Empty request body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      body = JSON.parse(requestText)
      text = body.text
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError)
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Valid text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Extract speaker from request body, default to vinaya_assist
    const speaker = body.speaker || "vinaya_assist"

    console.log(`🎤 Using speaker: ${speaker}`)

    const veenaApiKey = process.env.VEENA_API_KEY
    const veenaApiUrl = process.env.VEENA_API_URL

    if (!veenaApiKey || !veenaApiUrl) {
      return new Response(
        JSON.stringify({
          error:
            "Veena API not configured. Please set VEENA_API_KEY and VEENA_API_URL environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    const cleanText = text.trim()

    // 🎯 Validate text length (Veena requires min 28 characters)
    if (cleanText.length < 28) {
      console.warn(
        `⚠️ Text too short (${cleanText.length} chars), minimum 28 required`
      )
      return new Response(
        JSON.stringify({
          error: "Text must be at least 28 characters long",
          received_length: cleanText.length,
          minimum_required: 28,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // 🎯 KEY OPTIMIZATION: Enable streaming
    const requestBody = {
      text: cleanText,
      speaker_id: speaker,
      output_format: "wav",
      temperature: 0.5,
      streaming: true, // 🚀 This is the critical change!
      normalize: true,
    }

    console.log(`🎵 Starting streaming TTS for: "${cleanText.slice(0, 50)}..."`)

    // Call Veena API with streaming enabled
    const response = await fetch(`${veenaApiUrl}/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${veenaApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Veena API error:", errorText)
      throw new Error(
        `Veena API error: ${response.status} ${response.statusText}`
      )
    }

    // 🎵 Stream the audio response directly to client
    console.log("✅ Streaming audio response from Veena API")

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("❌ Streaming TTS error:", error)
    return new Response(
      JSON.stringify({
        error: "Error processing streaming TTS",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
