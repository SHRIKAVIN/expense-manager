import type { CreatePaymentInput } from "./types";

export type UpiPreferredApp = NonNullable<CreatePaymentInput["preferredApp"]>;

export type UpiAppOption = {
  id: UpiPreferredApp;
  label: string;
  shortLabel: string;
  /** Public path under /upi-logos/ */
  logo: string;
};

/**
 * In-app picker order: GPay → PhonePe → super.money → BHIM → WhatsApp → Amazon.
 * Logos are the assets provided by the product owner.
 */
export const UPI_APP_OPTIONS: UpiAppOption[] = [
  {
    id: "gpay",
    label: "Google Pay",
    shortLabel: "GPay",
    logo: "/upi-logos/gpay.png",
  },
  {
    id: "phonepe",
    label: "PhonePe",
    shortLabel: "PhonePe",
    logo: "/upi-logos/phonepe.png",
  },
  {
    id: "supermoney",
    label: "super.money",
    shortLabel: "super.money",
    logo: "/upi-logos/supermoney.png",
  },
  {
    id: "bhim",
    label: "BHIM",
    shortLabel: "BHIM",
    logo: "/upi-logos/bhim.png",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Pay",
    shortLabel: "WhatsApp",
    logo: "/upi-logos/whatsapp.png",
  },
  {
    id: "amazonpay",
    label: "Amazon Pay",
    shortLabel: "Amazon",
    logo: "/upi-logos/amazonpay.png",
  },
  {
    id: "generic",
    label: "Other UPI app",
    shortLabel: "Other",
    logo: "/upi-logos/other.svg",
  },
];
