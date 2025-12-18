import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AccountType, AccountTypeEnum } from '../../constants/general';

export interface ReferralCodeDocument extends Document {
  _id: string;
  userId: string; // The user who owns this referral code
  userType: AccountType; // CUSTOMER, DRIVER, etc.
  code: string; // Unique referral code (e.g., "JOHN2024")

  // Usage tracking
  timesUsed: number;
  maxUsageLimit?: number; // Optional limit on how many times code can be used
  isActive: boolean;

  // Campaign association
  campaignId?: string; // Optional: link to specific campaign

  createdAt: Date;
  updatedAt: Date;
}

const referralCodeSchema = new Schema<ReferralCodeDocument>(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, required: true, index: true },
    userType: {
      type: String,
      enum: AccountTypeEnum,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    timesUsed: { type: Number, default: 0 },
    maxUsageLimit: { type: Number }, // null means unlimited
    isActive: { type: Boolean, default: true },
    campaignId: { type: String, ref: 'ReferralCampaign', index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
referralCodeSchema.index({ code: 1 }, { unique: true });
referralCodeSchema.index({ userId: 1 });
referralCodeSchema.index({ isActive: 1 });
referralCodeSchema.index({ campaignId: 1 });

// Virtual to check if code is still usable
referralCodeSchema.virtual('isUsable').get(function () {
  if (!this.isActive) return false;
  if (!this.maxUsageLimit) return true; // Unlimited usage
  return this.timesUsed < this.maxUsageLimit;
});

const ReferralCode = mongoose.model<ReferralCodeDocument>(
  'ReferralCode',
  referralCodeSchema
);

export default ReferralCode;
