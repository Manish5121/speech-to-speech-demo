// Helper function to convert audio blob to base64 (simplified approach)
async function convertToBase64Wav(audioBlob: Blob): Promise<string> {
  // For now, let's just convert the blob directly to base64
  // The MediaRecorder should already be creating WAV format
  const arrayBuffer = await audioBlob.arrayBuffer()

  // Convert to base64
  const uint8Array = new Uint8Array(arrayBuffer)
  const binaryString = Array.from(uint8Array, (byte) =>
    String.fromCharCode(byte)
  ).join("")

  console.log("🔊 Audio details:", {
    size: arrayBuffer.byteLength,
    first16Bytes: Array.from(uint8Array.slice(0, 16))
      .map((b) => String.fromCharCode(b))
      .join(""),
  })

  return btoa(binaryString)
}

export async function POST(req: Request) {
  try {
    console.log("=== Transcription API Called ===")
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      console.log("❌ No audio file provided")
      return new Response("No audio file provided", { status: 400 })
    }

    console.log("✅ Audio file received:", {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
    })

    const wisprApiKey = process.env.WISPR_API_KEY
    const wisprApiUrl = process.env.WISPR_API_URL

    if (!wisprApiKey || !wisprApiUrl) {
      console.log("❌ Wispr API not configured")
      return new Response(
        JSON.stringify({
          error:
            "Wispr API not configured. Please set WISPR_API_KEY and WISPR_API_URL environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    console.log(
      "✅ Wispr API key configured:",
      wisprApiKey.substring(0, 10) + "..."
    )

    // Convert audio file to base64
    console.log("🔄 Converting audio to base64...")
    const audioBase64 = await convertToBase64Wav(audioFile)
    console.log("✅ Audio converted, base64 length:", audioBase64.length)

    // Call Wispr API with the correct endpoint
    const wisprEndpoint = "https://api.wisprflow.ai/api/v1/dash/api"
    console.log("🔄 Calling Wispr API:", wisprEndpoint)

    const requestBody = {
      audio: audioBase64,
      language: ["auto"], // Auto-detect language - supports Hindi, English, and many others
      context: {
        app: {
          type: "ai", // Voice AI assistant
        },
        dictionary_context: [],
        user_identifier: "voice_agent_user",
        textbox_contents: {
          before_text: "",
          selected_text: "",
          after_text: "",
        },
      },
    }

    console.log("📤 Request body structure:", {
      audio_length: audioBase64.length,
      language: requestBody.language,
      context: requestBody.context,
    })

    const response = await fetch(wisprEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${wisprApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    console.log(
      "📥 Wispr API response status:",
      response.status,
      response.statusText
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.log("❌ Wispr API error response:", errorText)
      throw new Error(
        `Wispr API error: ${response.status} ${response.statusText}`
      )
    }

    const result = await response.json()
    console.log("✅ Wispr API result:", {
      text: result.text,
      detected_language: result.detected_language,
      total_time: result.total_time,
    })

    const responseData = {
      transcription: result.text,
      confidence: 1.0, // Wispr doesn't return confidence, using 1.0
      detected_language: result.detected_language,
    }

    console.log("📤 Sending response:", responseData)

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ Transcription error:", error)
    return new Response(
      JSON.stringify({
        error: "Error processing transcription",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
