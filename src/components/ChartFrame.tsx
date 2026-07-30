import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ChartFrameProps = {
  className?: string;
  children: (width: number, height: number) => ReactNode;
};

/** Waits for a real layout size before rendering Recharts (avoids width/height -1 warnings). */
export function ChartFrame({ className, children }: ChartFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      const nextWidth = Math.floor(width);
      const nextHeight = Math.floor(height);
      setSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("w-full min-w-0", className)}>
      {size.width > 0 && size.height > 0 ? children(size.width, size.height) : null}
    </div>
  );
}
