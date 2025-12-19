import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AccountTypeEnum } from '../../constants/general';

export interface TransactionDocument extends Document {
  _id: string;
  id: string;
  transactionId: string; // Unique transaction reference

  // User information
  userId: string;
  userType: 'driver' | 'customer';

  // Transaction details
  type: 'credit' | 'debit';
  amount: number; // Amount in kobo
  currency: string;

  // Payment details
  paymentMethod: 'card' | 'bank_transfer' | 'wallet' | 'cash' | 'system';
  paymentReference?: string; // Paystack reference or other external ref

  // Transaction purpose
  purpose:
    | 'wallet_topup'
    | 'trip_payment'
    | 'trip_refund'
    | 'driver_earnings'
    | 'commission_deduction'
    | 'cashout'
    | 'bonus'
    | 'penalty'
    | 'adjustment';

  // Related entities
  tripId?: string;
  relatedTransactionId?: string; // For refunds, reversals

  // Status
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'reversed';

  // Balances (for audit trail)
  balanceBefore: number;
  balanceAfter: number;

  // Additional info
  description: string;
  metadata?: any;

  // External payment data
  paystackData?: {
    reference?: string;
    authorizationCode?: string;
    lastFour?: string;
    bank?: string;
    brand?: string;
  };

  // Timestamps
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<TransactionDocument>(
  {
    _id: { type: String, default: uuidv4 },
    transactionId: {
      type: String,
      unique: true,
      default: function () {
        return (
          'TXN' +
          Date.now().toString(36).toUpperCase() +
          Math.random().toString(36).substr(2, 5).toUpperCase()
        );
      },
    },

    userId: { type: String, required: true, index: true },
    userType: {
      type: String,
      enum: AccountTypeEnum,
      required: true,
    },

    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      get: (value: number) => Math.round(value),
    },
    currency: { type: String, default: 'NGN' },

    paymentMethod: {
      type: String,
      enum: ['card', 'bank_transfer', 'wallet', 'cash', 'system'],
      required: true,
    },
    paymentReference: { type: String },

    purpose: {
      type: String,
      enum: [
        'wallet_topup',
        'trip_payment',
        'trip_refund',
        'driver_earnings',
        'commission_deduction',
        'cashout',
        'bonus',
        'penalty',
        'adjustment',
      ],
      required: true,
    },

    tripId: { type: String, ref: 'Trip' },
    relatedTransactionId: { type: String, ref: 'Transaction' },

    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'reversed'],
      default: 'pending',
    },

    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },

    paystackData: {
      reference: String,
      authorizationCode: String,
      lastFour: String,
      bank: String,
      brand: String,
    },

    completedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      getters: true,
      transform: function (doc, ret) {
        // Convert amounts from kobo to naira for JSON output
        ret.amount = ret.amount / 100;
        ret.balanceBefore = ret.balanceBefore / 100;
        ret.balanceAfter = ret.balanceAfter / 100;
        return ret;
      },
    },
    toObject: { virtuals: true, getters: true },
  }
);

// Indexes for efficient queries
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ transactionId: 1 });
TransactionSchema.index({ tripId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ purpose: 1 });
TransactionSchema.index({ paymentReference: 1 });
TransactionSchema.index({ type: 1, userId: 1 });

// Virtual for formatted amount
TransactionSchema.virtual('formattedAmount').get(function () {
  const amount = this.amount / 100;
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
});

TransactionSchema.virtual('trip', {
  ref: 'Trip',
  localField: 'tripId',
  foreignField: '_id',
  justOne: true,
});

const Transaction = mongoose.model<TransactionDocument>(
  'Transaction',
  TransactionSchema
);
export default Transaction;
