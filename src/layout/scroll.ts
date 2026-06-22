import { createContext, useContext } from "react";

/**
 * Whether the app's internal scroll container has been scrolled past a small
 * threshold. Drives the sticky header's frosted background. The container is the
 * pinned-shell <main> (not the window), so headers must read this rather than
 * window.scrollY.
 */
export const ScrolledContext = createContext(false);

export function useScrolled(): boolean {
  return useContext(ScrolledContext);
}
