"use client"

interface SpeakerOption {
  id: string
  name: string
  description: string
}

const AVAILABLE_SPEAKERS: SpeakerOption[] = [
  { id: "charu_soft", name: "Charu", description: "Soft & Gentle" },
  { id: "ishana_spark", name: "Ishana", description: "Energetic & Bright" },
  { id: "kyra_prime", name: "Kyra", description: "Professional & Clear" },
  { id: "mohini_whispers", name: "Mohini", description: "Calm & Soothing" },
  { id: "keerti_joy", name: "Keerti", description: "Joyful & Warm" },
  { id: "varun_chat", name: "Varun", description: "Conversational & Friendly" },
  { id: "soumya_calm", name: "Soumya", description: "Peaceful & Serene" },
  { id: "agastya_impact", name: "Agastya", description: "Bold & Impactful" },
  {
    id: "maitri_connect",
    name: "Maitri",
    description: "Connected & Empathetic",
  },
  { id: "vinaya_assist", name: "Vinaya", description: "Helpful & Supportive" },
]

interface SpeakerSelectorProps {
  selectedSpeaker: string
  onSpeakerChange: (speakerId: string) => void
  disabled?: boolean
}

export default function SpeakerSelector({
  selectedSpeaker,
  onSpeakerChange,
  disabled = false,
}: SpeakerSelectorProps) {
  const selectedSpeakerInfo = AVAILABLE_SPEAKERS.find(
    (speaker) => speaker.id === selectedSpeaker
  )

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="speaker-select"
        className="text-sm font-medium text-gray-700"
      >
        Voice Selection
      </label>
      <div className="relative">
        <select
          id="speaker-select"
          value={selectedSpeaker}
          onChange={(e) => onSpeakerChange(e.target.value)}
          disabled={disabled}
          className={`
            w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            appearance-none cursor-pointer
          `}
        >
          {AVAILABLE_SPEAKERS.map((speaker) => (
            <option key={speaker.id} value={speaker.id}>
              {speaker.name} - {speaker.description}
            </option>
          ))}
        </select>
        {/* Custom dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Show current selection info */}
      {selectedSpeakerInfo && (
        <div className="text-xs px-1">
          {disabled ? (
            <div className="text-amber-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Speaker locked during response</span>
            </div>
          ) : (
            <div className="text-gray-500">
              Selected:{" "}
              <span className="font-medium">{selectedSpeakerInfo.name}</span> (
              {selectedSpeakerInfo.description})
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { AVAILABLE_SPEAKERS }
export type { SpeakerOption }
