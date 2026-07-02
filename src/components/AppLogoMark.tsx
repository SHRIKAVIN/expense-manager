import { useId } from "react";
import { cn } from "@/lib/cn";

interface AppLogoMarkProps {
  size?: number;
  className?: string;
}

/** Inline app logo — 3D list mark; tile follows \`data-theme\` via CSS variables. */
export function AppLogoMark({ size = 36, className }: AppLogoMarkProps) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className={cn("shrink-0 rounded-[14px]", className)}
    >
      <defs>
        <linearGradient id={`${uid}-tile`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--logo-tile-top)" />
          <stop offset="100%" stopColor="var(--logo-tile-bottom)" />
        </linearGradient>
        <linearGradient id={`${uid}-dot`} x1="40" y1="38" x2="48" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f2f2f2" />
          <stop offset="100%" stopColor="#d8d8d8" />
        </linearGradient>
        <filter id={`${uid}-pop`} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="0.55" floodColor="#000000" floodOpacity="0.38" />
          <feDropShadow dx="0" dy="-0.6" stdDeviation="0.2" floodColor="#ffffff" floodOpacity="0.42" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${uid}-tile)`} />
      <g filter={`url(#${uid}-pop)`} strokeLinecap="round" fill="none">
        <g stroke="rgba(0,0,0,0.32)" strokeWidth="4" transform="translate(0 1.1)">
          <path d="M20 22h24" />
          <path d="M20 32h24" />
          <path d="M20 42h14" />
        </g>
        <g stroke="rgba(255,255,255,0.38)" strokeWidth="4" transform="translate(0 -0.55)">
          <path d="M20 22h24" />
          <path d="M20 32h24" />
          <path d="M20 42h14" />
        </g>
        <g stroke="#ffffff" strokeWidth="4">
          <path d="M20 22h24" />
          <path d="M20 32h24" />
          <path d="M20 42h14" />
        </g>
      </g>
      <g filter={`url(#${uid}-pop)`}>
        <circle cx="44" cy="42.8" r="3.5" fill="rgba(0,0,0,0.28)" />
        <circle cx="44" cy="41.6" r="3.5" fill={`url(#${uid}-dot)`} />
      </g>
    </svg>
  );
}
