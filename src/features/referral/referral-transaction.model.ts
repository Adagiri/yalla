import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AccountType, AccountTypeEnum } from '../../constants/general';

export enum ReferralStatus {
  PENDING = 'PENDING', // Referral created but conditions not met
  QUALIFIED = 'QUALIFIED', // Both users met wallet balance requirement
  COMPLETED = 'COMPLETED', // Rewards have been issued
  EXPIRED = 'EXPIRED', // Campaign expired before qualification
  CANCELLED = 'CANCELLED', // Referral was cancelled
}

export const ReferralStatusEnum = Object.values(ReferralStatus);

export interface ReferralTransactionDocument extends Document {
  _id: string;

  // Referrer (person who shared the code)
  referrerId: string;
  referrerType: AccountType;

  // Referee (person who used the code)
  refereeId: string;
  refereeType: AccountType;

  // Referral details
  referralCode: string;
  campaignId?: string; // Optional: specific campaign this referral is part of

  // Status tracking
  status: ReferralStatus;
  qualifiedAt?: Date; // When both users met the wallet balance requirement
  completedAt?: Date; // When rewards were issued

  // Condition tracking
  referrerWalletBalance: number; // in kobo, at time of check
  refereeWalletBalance: number; // in kobo, at time of check
  requiredWalletBalance: number; // in kobo, the threshold that was required

  // Rewards tracking
  referrerRewardId?: string; // Link to the reward given to referrer
  refereeRewardId?: string; // Link to the reward given to referee

  // Metadata
  metadata?: {
    signupIp?: string;
    signupDevice?: string;
    notes?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const referralTransactionSchema = new Schema<ReferralTransactionDocument>(
  {
    _id: { type: String, default: uuidv4 },

    referrerId: { type: String, required: true, index: true },
    referrerType: {
      type: String,
      enum: AccountTypeEnum,
      required: true,
    },

    refereeId: { type: String, required: true, index: true },
    refereeType: {
      type: String,
      enum: AccountTypeEnum,
      required: true,
    },

    referralCode: { type: String, required: true },
    campaignId: { type: String, ref: 'ReferralCampaign', index: true },

    status: {
      type: String,
      enum: ReferralStatusEnum,
      default: ReferralStatus.PENDING,
    },

    qualifiedAt: { type: Date },
    completedAt: { type: Date },

    referrerWalletBalance: { type: Number, default: 0 },
    refereeWalletBalance: { type: Number, default: 0 },
    requiredWalletBalance: { type: Number, required: true },

    referrerRewardId: { type: String, ref: 'ReferralReward' },
    refereeRewardId: { type: String, ref: 'ReferralReward' },

    metadata: {
      signupIp: { type: String },
      signupDevice: { type: String },
      notes: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
referralTransactionSchema.index({ referrerId: 1, status: 1 });
referralTransactionSchema.index({ refereeId: 1 });
referralTransactionSchema.index({ referralCode: 1 });
referralTransactionSchema.index({ status: 1 });
referralTransactionSchema.index({ campaignId: 1, status: 1 });
referralTransactionSchema.index({ createdAt: -1 });

// Ensure a referee can only be referred once
referralTransactionSchema.index({ refereeId: 1 }, { unique: true });

const ReferralTransaction = mongoose.model<ReferralTransactionDocument>(
  'ReferralTransaction',
  referralTransactionSchema
);

export default ReferralTransaction;
