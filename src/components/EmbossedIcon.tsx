import type { ReactElement, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { isNavLottieIcon } from "@/components/navLottieMarker";

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
  sm: { box: "h-10 w-10", icon: 34, stroke: 1.9 },
  md: { box: "h-12 w-12", icon: 42, stroke: 2 },
} as const;

/** Gradient tile badge with embossed icon — header / nav use. */
export function IconBadge3D({ icon: Icon, size = "md", className }: IconBadge3DProps) {
  const dim = badgeSizes[size];
  const lottie = isNavLottieIcon(Icon);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm",
        dim.box,
        !lottie && "icon-badge-3d",
        className,
      )}
    >
      {lottie ? (
        <Icon size={dim.icon} />
      ) : (
        <EmbossedIcon icon={Icon} size={size === "sm" ? 17 : 20} strokeWidth={dim.stroke} />
      )}
    </div>
  );
}
