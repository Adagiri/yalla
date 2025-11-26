import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentSystemConfig extends Document {
  withdrawalInterval: 'instant' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  minimumWithdrawalAmount: number; // in kobo

  // Debt Management
  debtLimitEnabled: boolean;
  maxDebtLimit: number; // Maximum debt allowed (in kobo)
  debtGracePeriod: number; // Days before debt enforcement
  debtPenaltyRate: number; // Penalty percentage (0-100)

  // Wallet Configuration
  allowNegativeBalance: boolean;
  negativeBalanceLimit: number; // How far below 0 can wallets go (in kobo)

  // Paystack Configuration
  paystackBalanceCheckEnabled: boolean;
  paystackMinimumBalance: number; // Minimum balance required in Paystack wallet

  // Card Payment Configuration
  cardPreAuthEnabled: boolean; // Pre-authorize cards before trip
  cardPreAuthAmount: number; // Amount to pre-authorize (in kobo)
  cardCaptureDelay: number; // Minutes to wait before capturing payment

  // Refund Policy
  cancellationRefundEnabled: boolean;
  refundTimeframes: {
    beforeDriverAssigned: number; // Percentage refund (0-100)
    afterDriverAssigned: number;
    afterDriverArrived: number;
    afterTripStarted: number;
  };

  // Metadata
  isActive: boolean;
  effectiveFrom: Date;
  lastModifiedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSystemConfigSchema = new Schema<IPaymentSystemConfig>(
  {
    // Withdrawal Limits Configuration
    withdrawalInterval: {
      type: String,
      enum: ['instant', 'daily', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly',
      required: true,
    },
    minimumWithdrawalAmount: {
      type: Number,
      default: 50000, // ₦500
      min: 0,
    },

    // Debt Management
    debtLimitEnabled: {
      type: Boolean,
      default: true,
    },
    maxDebtLimit: {
      type: Number,
      default: -500000, // -₦5,000 (negative number)
      max: 0,
    },
    debtGracePeriod: {
      type: Number,
      default: 7, // 7 days
      min: 0,
    },
    debtPenaltyRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Wallet Configuration
    allowNegativeBalance: {
      type: Boolean,
      default: true,
    },
    negativeBalanceLimit: {
      type: Number,
      default: -500000, // -₦5,000
      max: 0,
    },

    // Paystack Configuration
    paystackBalanceCheckEnabled: {
      type: Boolean,
      default: true,
    },
    paystackMinimumBalance: {
      type: Number,
      default: 100000000, // ₦1,000,000
      min: 0,
    },

    // Card Payment Configuration
    cardPreAuthEnabled: {
      type: Boolean,
      default: false, // Disable by default until implemented
    },
    cardPreAuthAmount: {
      type: Number,
      default: 500000, // ₦5,000 pre-auth hold
      min: 0,
    },
    cardCaptureDelay: {
      type: Number,
      default: 15, // 15 minutes
      min: 0,
    },

    // Refund Policy
    cancellationRefundEnabled: {
      type: Boolean,
      default: true,
    },
    refundTimeframes: {
      beforeDriverAssigned: {
        type: Number,
        default: 100, // Full refund
        min: 0,
        max: 100,
      },
      afterDriverAssigned: {
        type: Number,
        default: 80, // 80% refund
        min: 0,
        max: 100,
      },
      afterDriverArrived: {
        type: Number,
        default: 50, // 50% refund
        min: 0,
        max: 100,
      },
      afterTripStarted: {
        type: Number,
        default: 0, // No refund
        min: 0,
        max: 100,
      },
    },

    // Metadata
    isActive: {
      type: Boolean,
      default: false,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    lastModifiedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure only one active config
PaymentSystemConfigSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

export default mongoose.model<IPaymentSystemConfig>(
  'PaymentSystemConfig',
  PaymentSystemConfigSchema
);
