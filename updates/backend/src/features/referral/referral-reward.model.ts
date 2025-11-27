import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AccountType, AccountTypeEnum } from '../../constants/general';
import { RewardType, RewardTypeEnum } from './referral-campaign.model';

export enum RewardStatus {
  PENDING = 'PENDING', // Reward created but not yet available
  AVAILABLE = 'AVAILABLE', // Ready to be used
  REDEEMED = 'REDEEMED', // Has been used
  EXPIRED = 'EXPIRED', // Expired before use
  CANCELLED = 'CANCELLED', // Cancelled by admin or system
}

export const RewardStatusEnum = Object.values(RewardStatus);

export interface ReferralRewardDocument extends Document {
  _id: string;

  // Recipient
  userId: string;
  userType: AccountType;

  // Reward details
  rewardType: RewardType;
  rewardValue: number; // Value depends on type
  maxValue?: number; // For percentage discounts

  // Source tracking
  referralTransactionId: string; // Link back to the referral transaction
  campaignId?: string; // Optional campaign link
  isReferrer: boolean; // true if this user was the referrer, false if referee

  // Status
  status: RewardStatus;
  availableFrom?: Date; // When reward becomes available
  expiresAt?: Date; // When reward expires
  redeemedAt?: Date; // When reward was used
  tripId?: string; // If redeemed, which trip it was used on

  // Metadata
  description: string; // e.g., "Free ride for referring John Doe"
  metadata?: {
    appliedToTripId?: string;
    appliedAmount?: number; // in kobo, actual discount/credit applied
    redemptionMethod?: string; // 'AUTO' | 'MANUAL'
  };

  createdAt: Date;
  updatedAt: Date;
}

const referralRewardSchema = new Schema<ReferralRewardDocument>(
  {
    _id: { type: String, default: uuidv4 },

    userId: { type: String, required: true, index: true },
    userType: {
      type: String,
      enum: AccountTypeEnum,
      required: true,
    },

    rewardType: {
      type: String,
      enum: RewardTypeEnum,
      required: true,
    },
    rewardValue: { type: Number, required: true },
    maxValue: { type: Number },

    referralTransactionId: {
      type: String,
      ref: 'ReferralTransaction',
      required: true,
      index: true,
    },
    campaignId: { type: String, ref: 'ReferralCampaign', index: true },
    isReferrer: { type: Boolean, required: true },

    status: {
      type: String,
      enum: RewardStatusEnum,
      default: RewardStatus.PENDING,
    },

    availableFrom: { type: Date },
    expiresAt: { type: Date },
    redeemedAt: { type: Date },
    tripId: { type: String, ref: 'Trip' },

    description: { type: String, required: true },

    metadata: {
      appliedToTripId: { type: String },
      appliedAmount: { type: Number },
      redemptionMethod: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // Convert kobo to naira for JSON output
        if (ret.rewardType === 'WALLET_CREDIT' || ret.rewardType === 'DISCOUNT_FIXED') {
          ret.rewardValue = ret.rewardValue / 100;
        }
        if (ret.maxValue) {
          ret.maxValue = ret.maxValue / 100;
        }
        if (ret.metadata?.appliedAmount) {
          ret.metadata.appliedAmount = ret.metadata.appliedAmount / 100;
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
referralRewardSchema.index({ userId: 1, status: 1 });
referralRewardSchema.index({ status: 1 });
referralRewardSchema.index({ expiresAt: 1 });
referralRewardSchema.index({ referralTransactionId: 1 });
referralRewardSchema.index({ campaignId: 1 });
referralRewardSchema.index({ tripId: 1 });
referralRewardSchema.index({ createdAt: -1 });

// Virtual to check if reward is currently usable
referralRewardSchema.virtual('isUsable').get(function () {
  if (this.status !== RewardStatus.AVAILABLE) return false;

  const now = new Date();

  // Check if available
  if (this.availableFrom && this.availableFrom > now) return false;

  // Check if expired
  if (this.expiresAt && this.expiresAt < now) return false;

  return true;
});

// Virtual to check if reward has expired
referralRewardSchema.virtual('hasExpired').get(function () {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
});

const ReferralReward = mongoose.model<ReferralRewardDocument>(
  'ReferralReward',
  referralRewardSchema
);

export default ReferralReward;
