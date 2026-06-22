import { useEffect } from "react";

/**
 * Keeps the `--app-height` CSS variable equal to the true visible viewport
 * height. iOS standalone PWAs report a stale height for `fixed`/`100%`/`100dvh`
 * boxes right after the app is reopened from the background, which leaves the
 * bottom nav floating above the real screen edge. We pin the app shell to this
 * JS-measured value and re-measure on every event iOS fires on resume — with a
 * few trailing re-measures because the first reading after `pageshow` is often
 * still wrong for a frame or two.
 */
export function useAppHeight(): void {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const timeouts: number[] = [];

    const apply = () => {
      root.style.setProperty("--app-height", `${window.innerHeight}px`);
    };

    // Measure now, on the next frame, and after short delays. iOS settles the
    // viewport a beat after resume, so trailing reads catch the correct value.
    const remeasure = () => {
      apply();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
      timeouts.forEach(clearTimeout);
      timeouts.length = 0;
      [60, 150, 300].forEach((ms) => {
        timeouts.push(window.setTimeout(apply, ms));
      });
    };

    remeasure();

    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", remeasure);
    window.addEventListener("pageshow", remeasure);
    document.addEventListener("visibilitychange", remeasure);
    window.visualViewport?.addEventListener("resize", apply);

    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", remeasure);
      window.removeEventListener("pageshow", remeasure);
      document.removeEventListener("visibilitychange", remeasure);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);
}
