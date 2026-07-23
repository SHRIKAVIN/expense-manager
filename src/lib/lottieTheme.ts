import type { ResolvedTheme } from "@/lib/types";

/** App ink on light / white on dark — same pair the menu icon uses. */
export function lottieInkColor(theme: ResolvedTheme): [number, number, number, number] {
  return theme === "dark" ? [1, 1, 1, 1] : [0x1d / 255, 0x1d / 255, 0x1f / 255, 1];
}

function isNearBlack(k: number[]) {
  return k[0] < 0.22 && k[1] < 0.22 && k[2] < 0.22;
}

function isNearWhite(k: number[]) {
  return k[0] > 0.85 && k[1] > 0.85 && k[2] > 0.85;
}

function remapColor(
  k: number[],
  ty: string | undefined,
  ink: [number, number, number, number],
): number[] {
  if (!Array.isArray(k) || k.length < 3) return k;
  if (!k.every((n) => typeof n === "number")) return k;

  // Strokes: treat black/white as theme ink (menu hamburger, settings outlines).
  if (ty === "st" && (isNearBlack(k) || isNearWhite(k))) {
    return [...ink];
  }
  // Fills: only remapping near-black silhouettes (leave light chrome / brand colors).
  if (ty === "fl" && isNearBlack(k)) {
    return [...ink];
  }
  return k;
}

function colorNeedsRemap(k: unknown, ty: string | undefined): boolean {
  if (!Array.isArray(k) || k.length < 3) return false;
  if (!k.every((n) => typeof n === "number")) return false;
  const c = k as number[];
  if (ty === "st") return isNearBlack(c) || isNearWhite(c);
  if (ty === "fl") return isNearBlack(c);
  return false;
}

/** True if this Lottie has monochrome strokes/fills that should follow theme ink. */
export function lottieNeedsInkTheme(data: object): boolean {
  let needed = false;
  const walk = (obj: unknown): void => {
    if (needed || !obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        walk(item);
        if (needed) return;
      }
      return;
    }
    const rec = obj as Record<string, unknown>;
    const ty = typeof rec.ty === "string" ? rec.ty : undefined;
    if ((ty === "st" || ty === "fl") && rec.c && typeof rec.c === "object") {
      const c = rec.c as Record<string, unknown>;
      if (colorNeedsRemap(c.k, ty)) {
        needed = true;
        return;
      }
    }
    for (const value of Object.values(rec)) {
      walk(value);
      if (needed) return;
    }
  };
  walk(data);
  return needed;
}

/**
 * Remap monochrome ink so icons stay visible in light + dark.
 * Returns the original reference when nothing needs remapping (avoids
 * structuredClone of huge image-sequence Lotties like dashboard — which
 * can fail or stall on mobile PWAs).
 */
export function applyLottieInkTheme(data: object, theme: ResolvedTheme): object {
  if (!lottieNeedsInkTheme(data)) return data;

  const ink = lottieInkColor(theme);
  const clone = structuredClone(data) as unknown;

  const walk = (obj: unknown): void => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }
    const rec = obj as Record<string, unknown>;
    const ty = typeof rec.ty === "string" ? rec.ty : undefined;
    if ((ty === "st" || ty === "fl") && rec.c && typeof rec.c === "object") {
      const c = rec.c as Record<string, unknown>;
      if (Array.isArray(c.k)) {
        c.k = remapColor(c.k as number[], ty, ink);
      }
    }
    for (const value of Object.values(rec)) walk(value);
  };

  walk(clone);
  return clone as object;
}
