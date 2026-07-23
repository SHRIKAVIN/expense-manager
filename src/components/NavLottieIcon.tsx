import { useEffect, type ReactElement, type SVGProps } from "react";
import { useLottie } from "lottie-react";
import { cn } from "@/lib/cn";
import dashboardAnimation from "@/assets/lottie/nav-dashboard.json";
import transactionsAnimation from "@/assets/lottie/nav-transactions.json";
import incomeAnimation from "@/assets/lottie/nav-income.json";
import budgetsAnimation from "@/assets/lottie/nav-budgets.json";
import insightsAnimation from "@/assets/lottie/nav-insights.json";
import settingsAnimation from "@/assets/lottie/nav-settings.json";
import menuAnimation from "@/assets/lottie/nav-menu.json";

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

function NavLottieView({
  animationData,
  size,
  zoom,
  speed = 1,
  className,
}: {
  animationData: object;
  size: number;
  zoom: number;
  speed?: number;
  className?: string;
}) {
  const renderSize = Math.round(size * zoom);
  const { View, animationItem } = useLottie(
    {
      animationData,
      loop: true,
      autoplay: true,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    },
    { width: renderSize, height: renderSize },
  );

  useEffect(() => {
    animationItem?.setSpeed(speed);
  }, [animationItem, speed]);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {View}
    </span>
  );
}

function createNavLottieIcon(
  animationData: object,
  zoom: number,
  speed = 1,
): NavLottieComponent {
  function NavLottieIcon({ size = 22, className }: NavIconProps) {
    return (
      <NavLottieView
        animationData={animationData}
        size={size}
        zoom={zoom}
        speed={speed}
        className={className}
      />
    );
  }
  NavLottieIcon[NAV_LOTTIE_MARKER] = true as const;
  return NavLottieIcon;
}

export const DashboardNavIcon = createNavLottieIcon(dashboardAnimation, 1.7);
export const TransactionsNavIcon = createNavLottieIcon(transactionsAnimation, 1.5);
export const IncomeNavIcon = createNavLottieIcon(incomeAnimation, 1.55);
export const BudgetsNavIcon = createNavLottieIcon(budgetsAnimation, 1.4);
export const InsightsNavIcon = createNavLottieIcon(insightsAnimation, 1.5);
export const SettingsNavIcon = createNavLottieIcon(settingsAnimation, 1.5);
export const MenuNavIcon = createNavLottieIcon(menuAnimation, 1.85, 0.65);
