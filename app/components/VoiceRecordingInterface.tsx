import PulsingOrb from "@/app/components/PulsingOrb"
import StatusIndicator from "@/app/components/StatusIndicator"

interface VoiceRecordingInterfaceProps {
  readonly isRecording: boolean
  readonly isTranscribing: boolean
  readonly isSynthesizing: boolean
  readonly chatStatus: string
  readonly onToggleRecording: () => void
  readonly disabled: boolean
}

/**
 * Component responsible for the voice recording interface
 * Combines the pulsing orb, status display, and transcription
 */
export default function VoiceRecordingInterface({
  isRecording,
  isTranscribing,
  isSynthesizing,
  chatStatus,
  onToggleRecording,
  disabled,
}: VoiceRecordingInterfaceProps) {
  return (
    <div className="text-center px-4 sm:px-8 relative">
      <div className="mb-4 relative flex justify-center">
        <PulsingOrb
          isRecording={isRecording}
          onToggleRecording={onToggleRecording}
          disabled={disabled}
        />
      </div>

      <StatusIndicator
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        isSynthesizing={isSynthesizing}
        chatStatus={chatStatus}
      />
    </div>
  )
}
