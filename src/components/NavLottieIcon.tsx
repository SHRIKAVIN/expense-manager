import { useMemo, type ReactElement } from "react";
import { useLottie } from "lottie-react";
import { cn } from "@/lib/cn";
import { applyLottieInkTheme } from "@/lib/lottieTheme";
import { useTheme } from "@/theme/ThemeProvider";
import {
  NAV_LOTTIE_MARKER,
  type NavIconProps,
  type NavLottieComponent,
} from "@/components/navLottieMarker";
import dashboardAnimation from "@/assets/lottie/nav-dashboard.json";
import transactionsAnimation from "@/assets/lottie/nav-transactions.json";
import incomeAnimation from "@/assets/lottie/nav-income.json";
import budgetsAnimation from "@/assets/lottie/nav-budgets.json";
import insightsAnimation from "@/assets/lottie/nav-insights.json";
import settingsAnimation from "@/assets/lottie/nav-settings.json";
import menuAnimation from "@/assets/lottie/nav-menu.json";
import calculatorAnimation from "@/assets/lottie/nav-calculator.json";

export type { NavIconProps } from "@/components/navLottieMarker";

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
  const { resolved } = useTheme();
  const themedData = useMemo(() => {
    const data = applyLottieInkTheme(animationData, resolved) as { fr?: number };
    // Bake playback rate into frame rate — more reliable than setSpeed for
    // image-sequence comps (dashboard), and avoids non-reactive animationItem.
    if (speed !== 1 && typeof data.fr === "number") {
      // Only clone when we must mutate fr on a shared (non-themed) object.
      if (data === animationData) {
        const clone = structuredClone(animationData) as { fr?: number };
        if (typeof clone.fr === "number") clone.fr = clone.fr * speed;
        return clone;
      }
      data.fr = data.fr * speed;
    }
    return data;
  }, [animationData, resolved, speed]);
  const renderSize = Math.round(size * zoom);
  const { View } = useLottie(
    {
      animationData: themedData,
      loop: true,
      autoplay: true,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    },
    { width: renderSize, height: renderSize },
  );

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
  function NavLottieIcon({ size = 22, className }: NavIconProps): ReactElement {
    const { resolved } = useTheme();
    return (
      <NavLottieView
        key={resolved}
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

export const DashboardNavIcon = createNavLottieIcon(dashboardAnimation, 1.9, 0.25);
export const TransactionsNavIcon = createNavLottieIcon(transactionsAnimation, 1.7);
export const IncomeNavIcon = createNavLottieIcon(incomeAnimation, 2.05);
export const BudgetsNavIcon = createNavLottieIcon(budgetsAnimation, 1.6);
export const InsightsNavIcon = createNavLottieIcon(insightsAnimation, 1.7, 0.4);
export const SettingsNavIcon = createNavLottieIcon(settingsAnimation, 1.7);
export const MenuNavIcon = createNavLottieIcon(menuAnimation, 1.95, 0.65);
export const CalculatorNavIcon = createNavLottieIcon(calculatorAnimation, 1.4, 0.5);
