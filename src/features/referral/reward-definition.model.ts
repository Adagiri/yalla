import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum RewardDefinitionType {
  NONE = 'NONE',
  FREE_RIDE = 'FREE_RIDE',
  WALLET_CREDIT = 'WALLET_CREDIT',
  DISCOUNT_PERCENTAGE = 'DISCOUNT_PERCENTAGE',
  DISCOUNT_FIXED = 'DISCOUNT_FIXED',
  SUBSCRIPTION_DISCOUNT = 'SUBSCRIPTION_DISCOUNT',
  BONUS_POINTS = 'BONUS_POINTS',
}

export const RewardDefinitionTypeEnum = Object.values(RewardDefinitionType);

export enum RewardValueType {
  NUMBER = 'NUMBER',
  PERCENTAGE = 'PERCENTAGE',
  NONE = 'NONE',
}

export const RewardValueTypeEnum = Object.values(RewardValueType);

export interface RewardDefinitionDocument extends Document {
  _id: string;
  type: RewardDefinitionType;
  name: string;
  description: string;
  valueType: RewardValueType;
  defaultValue?: number;
  isActive: boolean;
  isSystemDefined: boolean;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  requiresMaxValue: boolean;
  createdBy: string;
  lastModifiedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const rewardDefinitionSchema = new Schema<RewardDefinitionDocument>(
  {
    _id: { type: String, default: uuidv4 },
    type: {
      type: String,
      enum: RewardDefinitionTypeEnum,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    valueType: {
      type: String,
      enum: RewardValueTypeEnum,
      required: true,
    },
    defaultValue: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystemDefined: {
      type: Boolean,
      default: false,
    },
    unit: {
      type: String,
    },
    minValue: {
      type: Number,
    },
    maxValue: {
      type: Number,
    },
    requiresMaxValue: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      required: true,
      default: 'SYSTEM',
    },
    lastModifiedBy: {
      type: String,
      required: true,
      default: 'SYSTEM',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
rewardDefinitionSchema.index({ type: 1 });
rewardDefinitionSchema.index({ isActive: 1 });
rewardDefinitionSchema.index({ isSystemDefined: 1 });

const RewardDefinition = mongoose.model<RewardDefinitionDocument>(
  'RewardDefinition',
  rewardDefinitionSchema
);

export default RewardDefinition;
