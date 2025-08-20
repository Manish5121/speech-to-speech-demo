export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Valid text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

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
    if (cleanText.length === 0) {
      return new Response(JSON.stringify({ error: "Text cannot be empty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const requestBody = {
      text: cleanText,
      speaker_id: "vinaya_assist",
      output_format: "wav",
      temperature: 0.5,
      streaming: false,
      normalize: true,
    }

    // Call Veena API for text-to-speech
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
      let errorDetails = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.message || errorJson.error || errorText
      } catch {
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

    const contentType = response.headers.get("content-type")

    if (contentType?.includes("audio")) {
      const audioBuffer = await response.arrayBuffer()

      if (audioBuffer.byteLength === 0) {
        return new Response(
          JSON.stringify({ error: "Empty audio response from Veena API" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )
      }

      const base64Audio = Buffer.from(audioBuffer).toString("base64")

      return new Response(
        JSON.stringify({
          audio_data: base64Audio,
          content_type: contentType,
          message: "Audio generated successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    } else {
      const result = await response.json()

      if (result.error) {
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
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }
  } catch (error) {
    console.error("Text-to-speech error:", error)

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
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
