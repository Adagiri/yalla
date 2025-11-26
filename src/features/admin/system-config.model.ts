

import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document } from 'mongoose';

export interface SystemConfigDocument extends Document {
  _id: string;
  category: string;
  key: string;
  value: any;
  description?: string;
  dataType: string;
  isPublic: boolean;
  isRequired: boolean;
  defaultValue?: any;

  validationRules?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    allowedValues?: any[];
    regex?: string;
    dataType?: string;
  };

  requiredPermission?: string;
  lastModifiedBy: string;
  lastModifiedAt: Date;
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

const systemConfigSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    category: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String },
    dataType: { type: String, required: true },
    isPublic: { type: Boolean, default: false },
    isRequired: { type: Boolean, default: false },
    defaultValue: { type: Schema.Types.Mixed },

    validationRules: {
      min: { type: Number },
      max: { type: Number },
      minLength: { type: Number },
      maxLength: { type: Number },
      allowedValues: [{ type: Schema.Types.Mixed }],
      regex: { type: String },
      dataType: { type: String },
    },

    requiredPermission: { type: String },
    lastModifiedBy: { type: String, required: true },
    lastModifiedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

// Compound unique index
systemConfigSchema.index({ category: 1, key: 1 }, { unique: true });

export default mongoose.model<SystemConfigDocument>(
  'SystemConfig',
  systemConfigSchema
);