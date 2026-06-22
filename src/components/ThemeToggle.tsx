import { SegmentedControl, type Segment } from "./SegmentedControl";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/types";

const segments: Segment<ThemePreference>[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      ariaLabel="Theme preference"
      segments={segments}
      value={preference}
      onChange={setPreference}
    />
  );
}
