/**
 * Shared editorial fragments — BAIA's marine-survey identity layer.
 *
 * SectionStamp: a cartographic coordinate marker that echoes the hero's
 * LAT/LNG footer line, giving every chapter a surveyed, place-anchored feel.
 *
 * TideDivider: a hand-drawn tide contour — a single hairline swell that
 * separates major chapters the way a depth line crosses a nautical chart.
 */

export function SectionStamp({ label }: { label: string }) {
  return (
    <div className="coordinate-stamp">
      <span>10.55° N / 119.28° E</span>
      <span className="text-gold-500/60">·</span>
      <span>{label}</span>
    </div>
  );
}

export function TideDivider({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`w-full overflow-hidden leading-none text-gold-500/25 ${className}`}
    >
      <svg
        viewBox="0 0 1440 24"
        preserveAspectRatio="none"
        className="block w-full h-4 md:h-6"
        fill="none"
      >
        <path
          d="M0 12 C 120 4, 240 20, 360 12 S 600 4, 720 12 S 960 20, 1080 12 S 1320 4, 1440 12"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
