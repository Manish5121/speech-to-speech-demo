import { Volume2 } from "lucide-react"

interface StatusIndicatorProps {
  readonly isRecording: boolean
  readonly isTranscribing: boolean
  readonly isSynthesizing: boolean
  readonly chatStatus: string
}

/**
 * Component responsible for displaying the current status of the voice agent
 * Shows different states: recording, transcribing, AI thinking, playing response
 */
export default function StatusIndicator({
  isRecording,
  isTranscribing,
  isSynthesizing,
  chatStatus,
}: StatusIndicatorProps) {
  const getStatusMessage = () => {
    if (isRecording) return "Recording... Click to stop"
    if (isTranscribing) return "Transcribing audio..."
    if (chatStatus === "streaming") return "AI is thinking..."
    if (isSynthesizing) return "Playing response..."
    return "Click to start recording"
  }

  return (
    <>
      <p className="text-gray-500 text-sm sm:text-base mb-2">
        {getStatusMessage()}
      </p>

      {/* Status Indicators */}
      {isSynthesizing && (
        <div className="flex items-center justify-center gap-2 text-purple-600 mb-2">
          <Volume2 className="w-4 h-4" />
          <p className="text-sm">Playing response...</p>
        </div>
      )}
    </>
  )
}
