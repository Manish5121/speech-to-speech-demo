// Client-side authentication for Wispr API
export async function generateWisprClientToken(
  orgApiKey: string
): Promise<string> {
  try {
    const response = await fetch(
      "https://api.wisprflow.ai/api/v1/dash/generate_access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${orgApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: "voice_agent_user",
          duration_secs: 3600, // 1 hour
          metadata: {
            app_name: "Voice Agent",
            user_type: "demo_user",
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to generate token: ${response.status} ${errorText}`
      )
    }

    const result = await response.json()
    return result.access_token
  } catch (error) {
    console.error("Error generating Wispr client token:", error)
    throw error
  }
}
