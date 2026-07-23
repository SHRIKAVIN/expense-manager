import type { ReactElement, SVGProps } from "react";

export type NavIconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Marks icon components that render Lottie (skip SVG emboss layers). */
export const NAV_LOTTIE_MARKER = Symbol.for("expense-manager.navLottie");

type NavLottieComponent = ((props: NavIconProps) => ReactElement) & {
  [NAV_LOTTIE_MARKER]?: true;
};

export function isNavLottieIcon(
  icon: (props: NavIconProps) => ReactElement,
): icon is NavLottieComponent {
  return Boolean((icon as NavLottieComponent)[NAV_LOTTIE_MARKER]);
}

export type { NavLottieComponent };
