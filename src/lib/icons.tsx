import type { ReactElement, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, strokeWidth = 1.8, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

/* ---------- UI icons ---------- */

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </svg>
);

export const EditIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const MenuIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7h18M3 12h18M3 17h18" />
  </svg>
);

export const RefreshIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

export const CameraIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ChevronUpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m18 15-6-6-6 6" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

export const DownloadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M5 19h14" />
  </svg>
);

export const SunIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />
  </svg>
);

export const SystemIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.5V20h12V9.5" />
  </svg>
);

export const ListIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 19V5M4 19h16" />
    <path d="M8 16v-4M12 16V9M16 16v-6" />
  </svg>
);

export const WalletIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v0H5" />
    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5" />
    <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const IncomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v10" />
    <path d="m8 10 4 4 4-4" />
    <path d="M4 19h16" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base({ ...p, viewBox: "-2 -2 28 28" })}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </svg>
);

export const RepeatIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

/** Over-budget marker — an outline alert glyph, not a second color (§3.2). */
export const AlertIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);

export const LogoutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

export const FolderIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);

export const ArchiveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
  </svg>
);

/* ---------- Category icons ---------- */

export const FoodIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 2v7a3 3 0 0 0 6 0V2M9 2v20" />
    <path d="M17 2c-1.5 1-2 3-2 6s.5 4 2 4v10" />
  </svg>
);

export const TransportIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 13l1.5-5A2 2 0 0 1 8.4 6.5h7.2a2 2 0 0 1 1.9 1.5L19 13" />
    <path d="M4 13h16v5H4zM7 18v2M17 18v2" />
    <circle cx="7.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const ShoppingIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 7h12l-1 13H7L6 7Z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);

export const BillsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);

export const EntertainmentIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
  </svg>
);

export const HealthIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 21s-7-4.5-9.2-9A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9.2 6c-2.2 4.5-9.2 9-9.2 9Z" />
  </svg>
);

export const OtherIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const CoffeeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" />
    <path d="M17 9h2a2 2 0 0 1 0 4h-2M6 2v2M10 2v2M14 2v2" />
  </svg>
);

export const HomeCategoryIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 11 12 5l8 6" />
    <path d="M6 10v9h12v-9M10 19v-5h4v5" />
  </svg>
);

export const GiftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="9" width="16" height="11" rx="1" />
    <path d="M2 9h20v3H2zM12 9v11M12 9S9 3 6.5 5 12 9 12 9ZM12 9s3-6 5.5-4S12 9 12 9Z" />
  </svg>
);

export const PlaneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10 14 3 12l1-2 6 .5 4-5a2 2 0 0 1 3 3l-5 4 .5 6-2 1-2-7Z" />
  </svg>
);

export const BookIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z" />
    <path d="M4 19a2 2 0 0 1 2-2h12" />
  </svg>
);

export const PetIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="9" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="6.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="6.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="18" cy="9" r="1.6" fill="currentColor" stroke="none" />
    <path d="M12 11c-2.5 0-4.5 2-5 4-.4 1.6.8 3 2.4 3 .9 0 1.6-.4 2.6-.4s1.7.4 2.6.4c1.6 0 2.8-1.4 2.4-3-.5-2-2.5-4-5-4Z" />
  </svg>
);

/** Registry used by the icon picker and category rendering. */
export const CATEGORY_ICONS: Record<string, (p: IconProps) => ReactElement> = {
  food: FoodIcon,
  transport: TransportIcon,
  shopping: ShoppingIcon,
  bills: BillsIcon,
  entertainment: EntertainmentIcon,
  health: HealthIcon,
  other: OtherIcon,
  coffee: CoffeeIcon,
  home: HomeCategoryIcon,
  gift: GiftIcon,
  plane: PlaneIcon,
  book: BookIcon,
  pet: PetIcon,
  wallet: WalletIcon,
};

export function CategoryGlyph({
  icon,
  size = 22,
  className,
}: {
  icon: string;
  size?: number;
  className?: string;
}) {
  const Cmp = CATEGORY_ICONS[icon] ?? OtherIcon;
  return <Cmp size={size} className={className} />;
}

export const ICON_PICKER_KEYS = Object.keys(CATEGORY_ICONS);
