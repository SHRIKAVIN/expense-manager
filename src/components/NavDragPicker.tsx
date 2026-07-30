import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { IconBadge3D } from "@/components/EmbossedIcon";
import { APP_NAV } from "@/layout/appNav";
import { useAppData } from "@/data/AppDataProvider";
import { liquidSpring, pressProps, usePrefersReducedMotion } from "@/lib/motion";

interface NavDragPickerProps {
  /** Currently active route pathname. */
  pathname: string;
  open: boolean;
  onClose: () => void;
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
): number | null {
  for (let i = 0; i < roots.length; i++) {
    const el = roots[i];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) return i;
  }
  // Snap to nearest edge if slightly outside the list
  const first = roots[0]?.getBoundingClientRect();
  const last = roots[roots.length - 1]?.getBoundingClientRect();
  if (first && clientY < first.top) return 0;
  if (last && clientY > last.bottom) return roots.length - 1;
  return null;
}

/**
 * iOS 26–style drag scrubber for primary nav.
 * Drag up/down across items to move the liquid selection; release to navigate.
 * Tap still selects immediately.
 */
export function NavDragPicker({ pathname, open, onClose }: NavDragPickerProps) {
  const navigate = useNavigate();
  const { refresh } = useAppData();
  const reduced = usePrefersReducedMotion();
  const [focus, setFocus] = useState(() => routeIndex(pathname));
  const [dragging, setDragging] = useState(false);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastFocus = useRef(focus);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      const i = routeIndex(pathname);
      setFocus(i);
      lastFocus.current = i;
      setDragging(false);
      pointerId.current = null;
    }
  }, [open, pathname]);

  const bumpHaptic = (next: number) => {
    if (next === lastFocus.current) return;
    lastFocus.current = next;
    setFocus(next);
    if (!reduced && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
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

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (e.button !== 0) return;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    bumpHaptic(index);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    const next = indexFromPointerY(e.clientY, itemRefs.current);
    if (next != null) bumpHaptic(next);
  };

  const endPointer = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    const next = indexFromPointerY(e.clientY, itemRefs.current) ?? lastFocus.current;
    pointerId.current = null;
    setDragging(false);
    commit(next);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setDragging(false);
  };

  return (
    <div className="relative -mx-2 touch-none select-none" data-testid="nav-menu">
      <div className="relative flex flex-col gap-1">
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
                      scale: dragging && focused ? 1.04 : focused ? 1.02 : 1,
                      x: dragging && focused ? 4 : 0,
                    }
              }
              transition={liquidSpring}
              whileTap={reduced || dragging ? undefined : pressProps.whileTap}
            >
              {focused && (
                <motion.span
                  layoutId={reduced ? undefined : "menu-nav-pill"}
                  className={cn(
                    "liquid-nav-pill absolute inset-0 rounded-xl",
                    dragging && "liquid-nav-pill-active",
                  )}
                  transition={reduced ? { duration: 0 } : liquidSpring}
                />
              )}
              <motion.span
                className="relative shrink-0"
                animate={reduced ? undefined : { scale: focused ? 1.1 : 1 }}
                transition={liquidSpring}
              >
                {focused || activeRoute ? (
                  <IconBadge3D icon={Icon} size="md" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center text-ink-muted-80">
                    <Icon size={36} strokeWidth={1.8} />
                  </span>
                )}
              </motion.span>
              <span
                className={cn(
                  "relative",
                  focused ? "text-body-strong" : "text-body",
                )}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
