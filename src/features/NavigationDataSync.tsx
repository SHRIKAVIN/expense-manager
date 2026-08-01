import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAppData } from "@/data/AppDataProvider";

/** Refreshes workspace data on route changes and when the app returns to the foreground. */
export function NavigationDataSync() {
  const location = useLocation();
  const { ready, refresh } = useAppData();
  const skipNextRouteRefresh = useRef(true);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!ready) return;
    if (skipNextRouteRefresh.current) {
      skipNextRouteRefresh.current = false;
      return;
    }
    void refresh();
  }, [ready, location.pathname, location.key, refresh]);

  useEffect(() => {
    if (!ready) return;

    const wake = () => {
      if (document.visibilityState === "hidden") return;
      void refreshRef.current();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") wake();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [ready]);

  return null;
}
