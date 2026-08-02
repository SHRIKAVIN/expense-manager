import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue, useTransform, type Transition } from "framer-motion";
import { cn } from "@/lib/cn";
import { IconBadge3D } from "@/components/EmbossedIcon";
import { APP_NAV } from "@/layout/appNav";
import { useAppData } from "@/data/AppDataProvider";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";

/** The edge chasing the finger snaps hard; the edge left behind lags, so the pill stretches. */
const LEADING: Transition = { type: "spring", stiffness: 900, damping: 52, mass: 0.6 };
const TRAILING: Transition = { type: "spring", stiffness: 320, damping: 34, mass: 0.85 };
/** Settling after release: no stretch, just a soft landing. */
const SETTLE: Transition = { type: "spring", stiffness: 560, damping: 44, mass: 0.7 };

/** Distance the finger must travel before a press turns into a scrub. */
const SCRUB_SLOP = 6;
/** Holding still this long also enters scrub mode, matching iOS press-and-drag menus. */
const SCRUB_HOLD_MS = 160;
/** How far the pill can rubber-band past the first/last row. */
const MAX_OVERSCROLL = 14;
/** Let the pill visibly land on the row before the sheet closes. */
const COMMIT_DELAY_MS = 130;

interface NavDragPickerProps {
  /** Currently active route pathname. */
  pathname: string;
  open: boolean;
  onClose: () => void;
}

interface RowMetric {
  top: number;
  height: number;
}

function routeIndex(pathname: string) {
  const i = APP_NAV.findIndex((n) =>
    n.end ? pathname === n.to : pathname === n.to || pathname.startsWith(`${n.to}/`),
  );
  return i >= 0 ? i : 0;
}

function indexFromPointerY(
  clientY: number,
  roots: Array<HTMLElement | null>,
): { index: number; overscroll: number } | null {
  for (let i = 0; i < roots.length; i++) {
    const el = roots[i];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) return { index: i, overscroll: 0 };
  }
  const first = roots[0]?.getBoundingClientRect();
  const last = roots[roots.length - 1]?.getBoundingClientRect();
  if (first && clientY < first.top) {
    return { index: 0, overscroll: clientY - first.top };
  }
  if (last && clientY > last.bottom) {
    return { index: roots.length - 1, overscroll: clientY - last.bottom };
  }
  return null;
}

/** Logarithmic rubber band, the same falloff iOS uses past a scroll boundary. */
function rubberBand(distance: number) {
  const sign = Math.sign(distance);
  const eased = MAX_OVERSCROLL * (1 - 1 / (Math.abs(distance) / 60 + 1));
  return sign * eased;
}

/**
 * iOS-style drag scrubber for primary nav.
 * Press and drag up/down to slide the liquid highlight between rows; release to navigate.
 * A plain tap still selects immediately.
 */
export function NavDragPicker({ pathname, open, onClose }: NavDragPickerProps) {
  const navigate = useNavigate();
  const { refresh } = useAppData();
  const reduced = usePrefersReducedMotion();
  const [focus, setFocus] = useState(() => routeIndex(pathname));
  const [scrubbing, setScrubbing] = useState(false);
  const [ready, setReady] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const metrics = useRef<RowMetric[]>([]);
  const lastFocus = useRef(focus);
  const pointerId = useRef<number | null>(null);
  const pressStartY = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const commitTimer = useRef<number | null>(null);

  // The pill is one persistent element: its top and bottom edges are animated
  // independently so it stretches while travelling and re-squares when it lands.
  const pillTop = useMotionValue(0);
  const pillBottom = useMotionValue(0);
  const overscroll = useMotionValue(0);
  const pillY = useTransform([pillTop, overscroll], ([top, over]: number[]) => top + over);
  const pillHeight = useTransform([pillTop, pillBottom], ([top, bottom]: number[]) =>
    Math.max(bottom - top, 0),
  );

  const placePill = useCallback(
    (index: number, immediate: boolean) => {
      const m = metrics.current[index];
      if (!m) return;
      const top = m.top;
      const bottom = m.top + m.height;
      if (immediate || reduced) {
        pillTop.set(top);
        pillBottom.set(bottom);
        return;
      }
      const movingDown = top > pillTop.get();
      void animate(pillTop, top, movingDown ? TRAILING : LEADING);
      void animate(pillBottom, bottom, movingDown ? LEADING : TRAILING);
    },
    [pillBottom, pillTop, reduced],
  );

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const base = list.getBoundingClientRect().top;
    metrics.current = itemRefs.current.map((el) => {
      if (!el) return { top: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return { top: r.top - base, height: r.height };
    });
    setReady(metrics.current.some((m) => m.height > 0));
  }, []);

  useLayoutEffect(() => {
    // Keep the pill mounted while the sheet plays its exit animation.
    if (!open) return;
    const i = routeIndex(pathname);
    setFocus(i);
    lastFocus.current = i;
    setScrubbing(false);
    pointerId.current = null;
    overscroll.set(0);
    measure();
    placePill(i, true);

    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      measure();
      placePill(lastFocus.current, true);
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure, open, overscroll, pathname, placePill]);

  useEffect(
    () => () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      if (commitTimer.current) window.clearTimeout(commitTimer.current);
    },
    [],
  );

  const focusRow = (next: number, atEdge = false) => {
    if (next === lastFocus.current) return;
    lastFocus.current = next;
    setFocus(next);
    placePill(next, false);
    if (!reduced && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(atEdge ? 4 : 9);
    }
  };

  const commit = (index: number) => {
    const item = APP_NAV[index];
    if (!item) return;
    onClose();
    if (item.to !== pathname) {
      navigate(item.to);
    } else {
      void refresh();
    }
  };

  const commitSoon = (index: number) => {
    if (reduced) {
      commit(index);
      return;
    }
    commitTimer.current = window.setTimeout(() => commit(index), COMMIT_DELAY_MS);
  };

  const clearHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const releaseOverscroll = () => {
    if (overscroll.get() === 0) return;
    void animate(overscroll, 0, SETTLE);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (e.button !== 0) return;
    pointerId.current = e.pointerId;
    pressStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    focusRow(index);
    clearHold();
    holdTimer.current = window.setTimeout(() => setScrubbing(true), SCRUB_HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    if (!scrubbing && Math.abs(e.clientY - pressStartY.current) < SCRUB_SLOP) return;
    if (!scrubbing) {
      clearHold();
      setScrubbing(true);
    }
    const hit = indexFromPointerY(e.clientY, itemRefs.current);
    if (!hit) return;
    focusRow(hit.index, hit.overscroll !== 0);
    overscroll.set(hit.overscroll === 0 ? 0 : rubberBand(hit.overscroll));
  };

  const endPointer = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    const hit = indexFromPointerY(e.clientY, itemRefs.current);
    const next = hit?.index ?? lastFocus.current;
    pointerId.current = null;
    clearHold();
    setScrubbing(false);
    releaseOverscroll();
    if (next !== lastFocus.current) {
      lastFocus.current = next;
      setFocus(next);
    }
    // Land square on the row instead of stretching into it.
    const m = metrics.current[next];
    if (m && !reduced) {
      void animate(pillTop, m.top, SETTLE);
      void animate(pillBottom, m.top + m.height, SETTLE);
    }
    commitSoon(next);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    clearHold();
    setScrubbing(false);
    releaseOverscroll();
    placePill(lastFocus.current, false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const next = Math.min(Math.max(lastFocus.current + delta, 0), APP_NAV.length - 1);
      focusRow(next);
      itemRefs.current[next]?.focus();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(lastFocus.current);
    }
  };

  return (
    <div className="relative -mx-2 touch-none select-none" data-testid="nav-menu">
      <div ref={listRef} className="relative flex flex-col gap-1" onKeyDown={onKeyDown}>
        {ready && (
          <motion.span
            aria-hidden
            className={cn(
              "liquid-nav-pill pointer-events-none absolute inset-x-0 top-0 rounded-xl",
              scrubbing && "liquid-nav-pill-active",
            )}
            style={{ y: pillY, height: pillHeight }}
            initial={reduced ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: scrubbing ? 1.02 : 1 }}
            transition={SETTLE}
          />
        )}

        {APP_NAV.map(({ to, label, icon: Icon }, index) => {
          const focused = focus === index;
          const activeRoute = routeIndex(pathname) === index;
          return (
            <motion.button
              key={to}
              type="button"
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              data-testid={`nav-link-${to === "/" ? "dashboard" : to.slice(1)}`}
              onPointerDown={(e) => onPointerDown(e, index)}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={onPointerCancel}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left outline-none",
                focused ? "text-primary" : "text-ink",
              )}
              animate={
                reduced
                  ? undefined
                  : {
                      scale: scrubbing && focused ? 1.045 : focused ? 1.02 : 1,
                      x: scrubbing && focused ? 6 : 0,
                      opacity: scrubbing && !focused ? 0.5 : 1,
                    }
              }
              transition={SETTLE}
              whileTap={reduced || scrubbing ? undefined : pressProps.whileTap}
            >
              <motion.span
                className="relative shrink-0"
                animate={reduced ? undefined : { scale: focused ? 1.1 : 1 }}
                transition={SETTLE}
              >
                {focused || activeRoute ? (
                  <IconBadge3D icon={Icon} size="md" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center text-ink-muted-80">
                    <Icon size={36} strokeWidth={1.8} />
                  </span>
                )}
              </motion.span>
              <span className={cn("relative", focused ? "text-body-strong" : "text-body")}>
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
