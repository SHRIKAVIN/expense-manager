import type { CreatePaymentInput } from "./types";

export type UpiPreferredApp = NonNullable<CreatePaymentInput["preferredApp"]>;

export type UpiAppOption = {
  id: UpiPreferredApp;
  label: string;
  shortLabel: string;
  /** Public path under /upi-logos/ */
  logo: string;
};

/** In-app picker: WhatsApp Pay only. */
export const UPI_APP_OPTIONS: UpiAppOption[] = [
  {
    id: "whatsapp",
    label: "WhatsApp Pay",
    shortLabel: "WhatsApp",
    logo: "/upi-logos/whatsapp.png",
  },
];
