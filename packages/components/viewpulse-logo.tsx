import type { SVGProps } from "react";

type ViewPulseLogoProps = SVGProps<SVGSVGElement> & {
  /** Self-contained tile (favicon-style); header uses transparent bg + currentColor frame */
  variant?: "header" | "emblem";
};

/**
 * ViewPulse wordmark-free mark: viewport + pulse trace. Matches site --ink / --red.
 */
export function ViewPulseLogo({
  variant = "header",
  className,
  ...rest
}: ViewPulseLogoProps) {
  const frameStroke = variant === "emblem" ? "#ffffff" : "currentColor";
  const pulseStroke = "#e52d27";

  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...rest}
    >
      {variant === "emblem" ? <rect width="32" height="32" rx="7" fill="#0d0d0d" /> : null}
      <rect
        x="7"
        y="7"
        width="18"
        height="18"
        rx="2.75"
        stroke={frameStroke}
        strokeWidth="1.85"
      />
      <path
        className="vp-logo-pulse-stroke"
        d="M10 16h2.6l1.35-4.8 2.9 9.6 2.05-4.8H22"
        stroke={pulseStroke}
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
