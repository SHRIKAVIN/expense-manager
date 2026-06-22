export type ClassValue = string | number | false | null | undefined;

/** Tiny classnames joiner. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
