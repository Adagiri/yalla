import mongoose, { Schema, Document } from 'mongoose';

export interface ISecuritySetting extends Document {
  // Authentication
  sessionTimeoutHours: number;
  maxLoginAttempts: number;

  // Password Policy
  minimumPasswordLength: number;
  requireStrongPasswords: boolean;

  // Two-Factor Authentication
  requireMfaForAdmins: boolean;
  enable2faForAllUsers: boolean;

  // Security Features
  enableIpWhitelisting?: boolean;
  allowedIps?: string[];
  enableAuditLogging: boolean;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SecuritySettingSchema = new Schema<ISecuritySetting>(
  {
    // Authentication
    sessionTimeoutHours: {
      type: Number,
      required: [true, 'Session timeout is required'],
      min: [1, 'Session timeout must be at least 1 hour'],
      max: [720, 'Session timeout cannot exceed 720 hours (30 days)'],
      default: 24,
    },
    maxLoginAttempts: {
      type: Number,
      required: [true, 'Max login attempts is required'],
      min: [1, 'Max login attempts must be at least 1'],
      max: [10, 'Max login attempts cannot exceed 10'],
      default: 5,
    },

    // Password Policy
    minimumPasswordLength: {
      type: Number,
      required: [true, 'Minimum password length is required'],
      min: [6, 'Minimum password length must be at least 6'],
      max: [32, 'Minimum password length cannot exceed 32'],
      default: 8,
    },
    requireStrongPasswords: {
      type: Boolean,
      default: false,
    },

    // Two-Factor Authentication
    requireMfaForAdmins: {
      type: Boolean,
      default: true,
    },
    enable2faForAllUsers: {
      type: Boolean,
      default: false,
    },

    // Security Features
    enableIpWhitelisting: {
      type: Boolean,
      default: false,
    },
    allowedIps: [
      {
        type: String,
        match: [
          /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
          'Please enter valid IP addresses',
        ],
      },
    ],
    enableAuditLogging: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// this ensures only one active security setting
SecuritySettingSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

export default mongoose.model<ISecuritySetting>(
  'SecuritySetting',
  SecuritySettingSchema
);
