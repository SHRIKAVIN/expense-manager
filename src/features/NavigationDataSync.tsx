import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAppData } from "@/data/AppDataProvider";

/** Refreshes workspace data on route changes and when the app returns to the foreground. */
export function NavigationDataSync() {
  const location = useLocation();
  const { ready, refresh } = useAppData();
  const skipNextRouteRefresh = useRef(true);

  useEffect(() => {
    if (!ready) return;
    if (skipNextRouteRefresh.current) {
      skipNextRouteRefresh.current = false;
      return;
    }
    void refresh();
  }, [ready, location.pathname, location.key, refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return null;
}
