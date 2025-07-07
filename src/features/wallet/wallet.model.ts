import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface WalletDocument extends Document {
  id: string;
  userId: string;
  userType: 'driver' | 'customer';
  balance: number;
  currency: string;
  isActive: boolean;

  // Transaction limits
  dailyLimit: number;
  monthlyLimit: number;

  // Tracking
  totalCredits: number;
  totalDebits: number;
  lastTransactionAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<WalletDocument>(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, required: true, unique: true },
    userType: {
      type: String,
      enum: ['driver', 'customer'],
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
      get: (value: number) => Math.round(value * 100) / 100, // Round to 2 decimal places
      set: (value: number) => Math.round(value * 100) / 100,
    },
    currency: { type: String, default: 'NGN' },
    isActive: { type: Boolean, default: true },

    // Limits (in kobo for NGN)
    dailyLimit: { type: Number, default: 500000 }, // ₦5,000 default
    monthlyLimit: { type: Number, default: 2000000 }, // ₦20,000 default

    // Tracking
    totalCredits: { type: Number, default: 0 },
    totalDebits: { type: Number, default: 0 },
    lastTransactionAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      getters: true,
      transform: function (doc, ret) {
        // Convert balance from kobo to naira for JSON output
        ret.balance = ret.balance / 100;
        ret.totalCredits = ret.totalCredits / 100;
        ret.totalDebits = ret.totalDebits / 100;
        ret.dailyLimit = ret.dailyLimit / 100;
        ret.monthlyLimit = ret.monthlyLimit / 100;
        return ret;
      },
    },
    toObject: { virtuals: true, getters: true },
  }
);

// Indexes
WalletSchema.index({ userId: 1 });
WalletSchema.index({ userType: 1 });
WalletSchema.index({ isActive: 1 });

// Virtual for formatted balance
WalletSchema.virtual('formattedBalance').get(function () {
  return `₦${(this.balance / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
});

const Wallet = mongoose.model<WalletDocument>('Wallet', WalletSchema);
export default Wallet;
