import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RecurringFrequency } from '../../constants/general';

export interface SubscriptionPlanDocument extends Document {
  _id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly';
  price: number; // in kobo
  description?: string;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverSubscriptionDocument extends Document {
  _id: string;
  driverId: string;
  planId: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  paymentReference?: string;
  subscriptionNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription Plan Schema
const subscriptionPlanSchema = new Schema<SubscriptionPlanDocument>(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
      get: (value: number) => Math.round(value),
      set: (value: number) => Math.round(value * 100), // Convert to kobo
    },
    description: { type: String },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Driver Subscription Schema
const driverSubscriptionSchema = new Schema<DriverSubscriptionDocument>(
  {
    _id: { type: String, default: uuidv4 },
    driverId: { type: String, ref: 'Driver', required: true, index: true },
    planId: { type: String, ref: 'SubscriptionPlan', required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending'],
      default: 'pending',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true },
    paymentReference: { type: String },
    subscriptionNumber: {
      type: String,
      unique: true,
      default: function () {
        return (
          'SUB' +
          Date.now().toString(36).toUpperCase() +
          Math.random().toString(36).substr(2, 5).toUpperCase()
        );
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
driverSubscriptionSchema.index({ driverId: 1, status: 1 });
driverSubscriptionSchema.index({ endDate: 1, status: 1 });

export const SubscriptionPlan = mongoose.model<SubscriptionPlanDocument>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);

export const DriverSubscription = mongoose.model<DriverSubscriptionDocument>(
  'DriverSubscription',
  driverSubscriptionSchema
);
