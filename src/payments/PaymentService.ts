import type { CreatePaymentInput, PaymentIntent, PaymentProvider, PaymentProviderId } from "./types";
import { upiPaymentProvider } from "./upi";

const providers: Record<PaymentProviderId, PaymentProvider> = {
  upi: upiPaymentProvider,
};

/** Facade over payment providers — reimbursement UI depends only on this. */
export const PaymentService = {
  getProvider(id: PaymentProviderId = "upi"): PaymentProvider {
    const p = providers[id];
    if (!p) {
      throw new Error(`Payment provider "${id}" is not configured yet.`);
    }
    return p;
  },

  async createIntent(
    input: CreatePaymentInput,
    providerId: PaymentProviderId = "upi",
  ): Promise<PaymentIntent> {
    return this.getProvider(providerId).createIntent(input);
  },

  async launch(intent: PaymentIntent): Promise<void> {
    return this.getProvider(intent.providerId).launch(intent);
  },

  async createAndLaunch(
    input: CreatePaymentInput,
    providerId: PaymentProviderId = "upi",
  ): Promise<PaymentIntent> {
    const intent = await this.createIntent(input, providerId);
    await this.launch(intent);
    return intent;
  },
};
