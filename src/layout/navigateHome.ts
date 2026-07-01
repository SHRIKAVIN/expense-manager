import type { NavigateFunction } from "react-router-dom";

/** Navigate to dashboard and scroll the main content area to the top. */
export function goToDashboard(navigate: NavigateFunction, pathname: string) {
  if (pathname !== "/") navigate("/");
  requestAnimationFrame(() => {
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  });
}
