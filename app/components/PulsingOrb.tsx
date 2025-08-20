"use client"

import { PulsingBorder } from "@paper-design/shaders-react"

interface PulsingOrbProps {
  isRecording: boolean
  onToggleRecording: () => void
  disabled?: boolean
}

export default function PulsingOrb({
  isRecording,
  onToggleRecording,
  disabled,
}: PulsingOrbProps) {
  return (
    <button
      onClick={onToggleRecording}
      disabled={disabled}
      className="relative w-32 h-32 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <PulsingBorder
        colors={
          isRecording
            ? ["#FF4C3E", "#E77EDC", "#FF6B35"] // Red tones when recording
            : [
                "#BEECFF",
                "#E77EDC",
                "#FF4C3E",
                "#00FF88",
                "#FFD700",
                "#FF6B35",
                "#8A2BE2",
              ]
        }
        colorBack="#00000000"
        speed={isRecording ? 2.5 : 1.5}
        roundness={1}
        thickness={0.12}
        softness={0.8}
        intensity={isRecording ? 8 : 5}
        spotSize={0.12}
        pulse={isRecording ? 0.2 : 0.1}
        smoke={0.6}
        smokeSize={4}
        scale={0.8}
        rotation={0}
        frame={9161408.251009725}
        style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-6 h-6 rounded-full transition-all duration-300 ${
            isRecording ? "bg-red-500 animate-pulse" : "bg-blue-500/90"
          }`}
        />
      </div>
    </button>
  )
}
