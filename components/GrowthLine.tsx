export function GrowthLine() {
  return (
    <svg
      viewBox="0 0 480 320"
      fill="none"
      className="w-full max-w-md"
      aria-hidden="true"
    >
      {/* grade de fundo, sutil */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="0"
          y1={64 * i}
          x2="480"
          y2={64 * i}
          stroke="#E6E3EA"
          strokeWidth="1"
        />
      ))}

      <path
        d="M20 260 C 90 260, 110 230, 150 210 S 220 160, 260 150 S 330 90, 380 70 S 440 40, 460 20"
        stroke="url(#lineGradient)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: 1,
          animation: "draw-line 2.2s cubic-bezier(0.65, 0, 0.35, 1) forwards",
        }}
      />

      <circle cx="460" cy="20" r="6" fill="#FF007A">
        <animate
          attributeName="opacity"
          values="0;0;1"
          keyTimes="0;0.85;1"
          dur="2.2s"
          fill="freeze"
        />
      </circle>
      <circle cx="460" cy="20" r="6" fill="none" stroke="#FF007A" strokeWidth="2">
        <animate
          attributeName="r"
          values="6;16"
          dur="1.6s"
          begin="2.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.6;0"
          dur="1.6s"
          begin="2.2s"
          repeatCount="indefinite"
        />
      </circle>

      <defs>
        <linearGradient id="lineGradient" x1="20" y1="260" x2="460" y2="20">
          <stop stopColor="#FF007A" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FF007A" />
        </linearGradient>
      </defs>

      <style>{`
        @keyframes draw-line {
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          path { animation: none !important; stroke-dashoffset: 0 !important; }
        }
      `}</style>
    </svg>
  );
}
