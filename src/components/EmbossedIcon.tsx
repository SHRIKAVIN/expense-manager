import type { ReactElement, SVGProps } from "react";
import { cn } from "@/lib/cn";

type IconComponent = (props: SVGProps<SVGSVGElement> & { size?: number }) => ReactElement;

interface EmbossedIconProps {
  icon: IconComponent;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** Stroke icon with shadow + highlight layers for a raised 3D look. */
export function EmbossedIcon({
  icon: Icon,
  size = 20,
  strokeWidth = 2,
  className,
}: EmbossedIconProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="pointer-events-none absolute inset-0 flex translate-y-px items-center justify-center text-black/35">
        <Icon size={size} strokeWidth={strokeWidth} />
      </span>
      <span className="pointer-events-none absolute inset-0 flex -translate-y-px items-center justify-center text-white/40">
        <Icon size={size} strokeWidth={strokeWidth} />
      </span>
      <span className="relative flex items-center justify-center text-white">
        <Icon size={size} strokeWidth={strokeWidth} />
      </span>
    </span>
  );
}

interface IconBadge3DProps {
  icon: IconComponent;
  size?: "sm" | "md";
  className?: string;
}

const badgeSizes = {
  sm: { box: "h-8 w-8", icon: 17, stroke: 1.9 },
  md: { box: "h-10 w-10", icon: 20, stroke: 2 },
} as const;

/** Gradient tile badge with embossed icon — header / nav use. */
export function IconBadge3D({ icon, size = "md", className }: IconBadge3DProps) {
  const dim = badgeSizes[size];
  return (
    <div
      className={cn(
        "icon-badge-3d flex shrink-0 items-center justify-center rounded-sm",
        dim.box,
        className,
      )}
    >
      <EmbossedIcon icon={icon} size={dim.icon} strokeWidth={dim.stroke} />
    </div>
  );
}
