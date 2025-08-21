/**
 * Reusable component for section dividers
 * Provides consistent visual separation between sections
 */
export default function SectionDivider() {
  return (
    <div className="relative h-6 border-y">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, #e4e4e7 0 1px, transparent 1px 10px)",
          opacity: 1,
        }}
      />
    </div>
  )
}
