export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    console.log("=== TTS API Called ===")
    console.log("📤 Text to synthesize:", text)

    if (!text || typeof text !== "string") {
      console.log("❌ Invalid text provided:", text)
      return new Response(JSON.stringify({ error: "Valid text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const veenaApiKey = process.env.VEENA_API_KEY
    const veenaApiUrl = process.env.VEENA_API_URL

    console.log("🔑 Veena API key configured:", veenaApiKey ? "✅" : "❌")
    console.log("🌐 Veena API URL:", veenaApiUrl)

    if (!veenaApiKey || !veenaApiUrl) {
      console.log("❌ Veena API not configured")
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

    // Clean and prepare text for TTS
    const cleanText = text.trim()
    if (cleanText.length === 0) {
      console.log("❌ Empty text after cleaning")
      return new Response(JSON.stringify({ error: "Text cannot be empty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log("🔄 Calling Veena API...")
    console.log("📍 Endpoint:", `${veenaApiUrl}/generate`)

    const requestBody = {
      text: cleanText,
      speaker_id: "vinaya_assist", // Using the assistant voice from documentation
      output_format: "wav",
      temperature: 0.5,
      streaming: false,
      normalize: true,
    }

    console.log("📤 Request body:", requestBody)

    // Call Veena API for text-to-speech
    const response = await fetch(`${veenaApiUrl}/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${veenaApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    console.log(
      "📥 Veena API response status:",
      response.status,
      response.statusText
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.log("❌ Veena API error response:", errorText)

      // Try to parse error as JSON for better error handling
      let errorDetails = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.message || errorJson.error || errorText
      } catch (e) {
        // If it's not JSON, use the raw error text
      }

      return new Response(
        JSON.stringify({
          error: `Veena API error: ${response.status} ${response.statusText}`,
          details: errorDetails,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Check content type
    const contentType = response.headers.get("content-type")
    console.log("📄 Response content-type:", contentType)

    if (contentType?.includes("audio")) {
      // Return audio as base64 for client-side playback
      console.log("🎵 Processing audio response...")
      const audioBuffer = await response.arrayBuffer()

      if (audioBuffer.byteLength === 0) {
        console.log("❌ Empty audio buffer received")
        return new Response(
          JSON.stringify({ error: "Empty audio response from Veena API" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )
      }

      const base64Audio = Buffer.from(audioBuffer).toString("base64")
      console.log("✅ Audio processed successfully")
      console.log("📊 Audio stats:", {
        bufferSize: audioBuffer.byteLength,
        base64Length: base64Audio.length,
        contentType: contentType,
      })

      return new Response(
        JSON.stringify({
          audio_data: base64Audio,
          content_type: contentType,
          message: "Audio generated successfully",
          text: cleanText,
          stats: {
            audio_size: audioBuffer.byteLength,
            base64_size: base64Audio.length,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    } else {
      // Handle JSON response (might contain audio URL or error)
      const result = await response.json()
      console.log("📦 JSON response from Veena:", result)

      if (result.error) {
        console.log("❌ Veena API returned error in JSON:", result.error)
        return new Response(
          JSON.stringify({
            error: "Veena API error",
            details: result.error,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(
        JSON.stringify({
          audio_url: result.audio_url || null,
          message: result.message || "Audio generated successfully",
          text: cleanText,
          veena_response: result,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }
  } catch (error) {
    console.error("❌ Text-to-speech error:", error)

    // Provide more specific error information
    let errorMessage = "Error processing text-to-speech"
    let errorDetails = "Unknown error"

    if (error instanceof Error) {
      errorDetails = error.message
      if (error.message.includes("fetch")) {
        errorMessage = "Failed to connect to Veena API"
      } else if (error.message.includes("JSON")) {
        errorMessage = "Invalid response from Veena API"
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
