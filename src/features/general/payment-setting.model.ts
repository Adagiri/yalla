import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentSetting extends Document {
  // Payment Methods
  cashPaymentsEnabled: boolean;
  walletPaymentsEnabled: boolean;
  paystackEnabled: boolean;
  flutterwaveEnabled: boolean;

  // Wallet Configuration
  minimumWalletBalance: number;
  processingFeeRate: number;
  autoTopupEnabled: boolean;
  autoTopupThreshold: number;
  autoTopupAmount: number;

  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSettingSchema = new Schema<IPaymentSetting>(
  {
    // Payment Methods
    cashPaymentsEnabled: {
      type: Boolean,
      default: false,
    },
    walletPaymentsEnabled: {
      type: Boolean,
      default: false,
    },
    paystackEnabled: {
      type: Boolean,
      default: true,
    },
    flutterwaveEnabled: {
      type: Boolean,
      default: false,
    },

    // Wallet Configuration
    minimumWalletBalance: {
      type: Number,
      required: [true, 'Minimum wallet balance is required'],
      min: [100, 'Minimum wallet balance cannot be negative'],
    },
    processingFeeRate: {
      type: Number,
      required: [true, 'Processing fee rate is required'],
      min: [0, 'Processing fee rate cannot be negative'],
      max: [10, 'Processing fee rate cannot exceed 10%'],
    },
    autoTopupEnabled: {
      type: Boolean,
      default: false,
    },
    autoTopupThreshold: {
      type: Number,
      min: [0, 'Auto top-up threshold cannot be negative'],
    },
    autoTopupAmount: {
      type: Number,
      min: [0, 'Auto top-up amount cannot be negative'],
    },

    currency: {
      type: String,
      default: 'NGN',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ensure only one active payment setting
PaymentSettingSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

export default mongoose.model<IPaymentSetting>(
  'PaymentSetting',
  PaymentSettingSchema
);
