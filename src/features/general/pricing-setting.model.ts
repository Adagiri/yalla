import mongoose, { Schema, Document } from 'mongoose';

export interface IPricingSetting extends Document {
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
  maximumFare: number;
  surgeMultiplier: number;
  commissionRate: number;
  cancellationFee: number;
  currency: string;
  isActive: boolean;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PricingSettingSchema = new Schema<IPricingSetting>(
  {
    baseFare: {
      type: Number,
      required: [true, 'Base fare is required'],
      min: [0, 'Base fare cannot be negative'],
    },
    perKmRate: {
      type: Number,
      required: [true, 'Per kilometer rate is required'],
      min: [0, 'Per kilometer rate cannot be negative'],
    },
    perMinuteRate: {
      type: Number,
      required: [true, 'Per minute rate is required'],
      min: [0, 'Per minute rate cannot be negative'],
    },
    minimumFare: {
      type: Number,
      required: [true, 'Minimum fare is required'],
      min: [0, 'Minimum fare cannot be negative'],
    },
    maximumFare: {
      type: Number,
      required: [true, 'Maximum fare is required'],
      min: [0, 'Maximum fare cannot be negative'],
      validate: {
        validator: function (this: IPricingSetting, value: number) {
          return value >= this.minimumFare;
        },
        message: 'Maximum fare must be greater than or equal to minimum fare',
      },
    },
    surgeMultiplier: {
      type: Number,
      required: [true, 'Surge multiplier is required'],
      min: [1, 'Surge multiplier must be at least 1'],
      max: [5, 'Surge multiplier cannot exceed 5'],
    },
    commissionRate: {
      type: Number,
      required: [true, 'Commission rate is required'],
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%'],
    },
    cancellationFee: {
      type: Number,
      required: [true, 'Cancellation fee is required'],
      min: [0, 'Cancellation fee cannot be negative'],
    },
    currency: {
      type: String,
      default: 'NGN',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure only one active pricing setting
PricingSettingSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

export default mongoose.model<IPricingSetting>(
  'PricingSetting',
  PricingSettingSchema
);
