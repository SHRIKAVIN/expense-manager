import { useEffect, type RefObject } from "react";

/**
 * Pin a fixed overlay to the iOS visual viewport so bottom sheets stay at the
 * true bottom when the software keyboard opens. Without this, iOS scrolls the
 * layout viewport and the sheet appears to jump upward.
 */
export function useVisualViewportOverlay(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;

    const sync = () => {
      // Only lock explicitly to visualViewport when the software keyboard is active
      // or visualViewport is scrolled. On iOS PWA standalone mode without keyboard,
      // vv.height can differ from window.innerHeight, which shrinks fixed overlays and leaves extra space at the bottom.
      const isKeyboardActive = window.innerHeight - vv.height > 40 || vv.offsetTop > 0;
      if (isKeyboardActive) {
        el.style.top = `${vv.offsetTop}px`;
        el.style.left = `${vv.offsetLeft}px`;
        el.style.width = `${vv.width}px`;
        el.style.height = `${vv.height}px`;
      } else {
        el.style.top = "";
        el.style.left = "";
        el.style.width = "";
        el.style.height = "";
      }
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      if (el) {
        el.style.top = "";
        el.style.left = "";
        el.style.width = "";
        el.style.height = "";
      }
    };
  }, [ref, active]);
}
