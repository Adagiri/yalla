export const PaymentModelSUBSCRIPTION = 'SUBSCRIPTION';
export const PaymentModelCOMMISSION = 'COMMISSION';

export const PaymentModel = {
  SUBSCRIPTION: PaymentModelSUBSCRIPTION,
  COMMISSION: PaymentModelCOMMISSION,
} as const;

export type PaymentModel = (typeof PaymentModel)[keyof typeof PaymentModel];

export const PaymentModelEnum = [
  PaymentModel.SUBSCRIPTION,
  PaymentModel.COMMISSION,
];

// Business configuration
export const PAYMENT_MODEL_CONFIG = {
  DEFAULT_MODEL: PaymentModel.SUBSCRIPTION,
  COMMISSION_RATE: 0.25, // 25% platform commission
  DRIVER_EARNINGS_RATE: 0.75, // 75% driver earnings
  ALLOW_MODEL_SWITCHING: true, // Can be disabled via admin
  SUBSCRIPTION_ENFORCEMENT: true, // Require active subscription for SUBSCRIPTION model
} as const;
