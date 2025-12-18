import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum ConstraintType {
  NONE = 'NONE',
  MIN_WALLET_BALANCE = 'MIN_WALLET_BALANCE',
  MIN_TRIP_COUNT = 'MIN_TRIP_COUNT',
  ACCOUNT_AGE_DAYS = 'ACCOUNT_AGE_DAYS',
  VERIFIED_ACCOUNT = 'VERIFIED_ACCOUNT',
  COMPLETED_PROFILE = 'COMPLETED_PROFILE',
  FIRST_TRIP_COMPLETED = 'FIRST_TRIP_COMPLETED',
  MIN_RATING = 'MIN_RATING',
}

export const ConstraintTypeEnum = Object.values(ConstraintType);

export enum ConstraintValueType {
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  NONE = 'NONE',
}

export const ConstraintValueTypeEnum = Object.values(ConstraintValueType);

export enum ConstraintAppliesTo {
  REFERRER = 'REFERRER',
  REFEREE = 'REFEREE',
  BOTH = 'BOTH',
}

export const ConstraintAppliesToEnum = Object.values(ConstraintAppliesTo);

export interface ConstraintDefinitionDocument extends Document {
  _id: string;
  type: ConstraintType;
  name: string;
  description: string;
  valueType: ConstraintValueType;
  defaultValue?: number | boolean;
  appliesTo: ConstraintAppliesTo;
  isActive: boolean;
  isSystemDefined: boolean;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  createdBy: string;
  lastModifiedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const constraintDefinitionSchema = new Schema<ConstraintDefinitionDocument>(
  {
    _id: { type: String, default: uuidv4 },
    type: {
      type: String,
      enum: ConstraintTypeEnum,
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
      enum: ConstraintValueTypeEnum,
      required: true,
    },
    defaultValue: {
      type: Schema.Types.Mixed,
    },
    appliesTo: {
      type: String,
      enum: ConstraintAppliesToEnum,
      required: true,
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
constraintDefinitionSchema.index({ type: 1 });
constraintDefinitionSchema.index({ isActive: 1 });
constraintDefinitionSchema.index({ isSystemDefined: 1 });
constraintDefinitionSchema.index({ appliesTo: 1 });

const ConstraintDefinition = mongoose.model<ConstraintDefinitionDocument>(
  'ConstraintDefinition',
  constraintDefinitionSchema
);

export default ConstraintDefinition;
