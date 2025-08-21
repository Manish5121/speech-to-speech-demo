interface TranscriptionDisplayProps {
  readonly transcription: string
}

/**
 * Component responsible for displaying the transcribed text
 * Shows what the user said after voice recording
 */
export default function TranscriptionDisplay({
  transcription,
}: TranscriptionDisplayProps) {
  if (!transcription) return null

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg max-w-md mx-auto">
      <p className="text-sm text-gray-600 mb-1">You said:</p>
      <p className="text-gray-900">{transcription}</p>
    </div>
  )
}
