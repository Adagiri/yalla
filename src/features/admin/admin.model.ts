import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AccountType, AuthChannelEnum } from '../../constants/general';

export interface AdminModelType extends Document {
  _id: string;
  id?: string;
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  accountType: AccountType;

  // Admin-specific fields
  role: 'super_admin' | 'admin' | 'manager' | 'support' | 'analyst';
  permissions: string[];
  department: string;
  employeeId?: string;

  // Authentication & Security
  isEmailVerified: boolean;
  isMFAEnabled: boolean;
  authChannels: string[];
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;

  // Access Control
  isActive: boolean;
  accessLevel: number; // 1-10 (10 being highest)
  allowedIPs?: string[];
  sessionTimeoutMinutes: number;

  // Audit Trail
  createdBy?: string;
  lastModifiedBy?: string;
  lastPasswordChange?: Date;

  // Profile
  profilePhoto?: string;
  phone?: string;
  timezone: string;
  language: string;

  // Preferences
  dashboardConfig?: any;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    criticalAlerts: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminModelType>(
  {
    _id: { type: String, default: uuidv4 },
    accountType: { type: String, default: AccountType.ADMIN },

    // Basic Info
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: { type: String, required: true, select: false },

    // Admin Role & Permissions
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'manager', 'support', 'analyst'],
      default: 'admin',
    },
    permissions: { type: [String], default: [] },
    department: { type: String, default: 'operations' },
    employeeId: { type: String, unique: true, sparse: true },

    // Authentication
    isEmailVerified: { type: Boolean, default: false },
    isMFAEnabled: { type: Boolean, default: false },
    authChannels: {
      type: [String],
      enum: AuthChannelEnum,
      default: ['EMAIL'],
    },
    lastLoginAt: { type: Date },
    lastActiveAt: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },

    // Access Control
    isActive: { type: Boolean, default: true },
    accessLevel: { type: Number, min: 1, max: 10, default: 5 },
    allowedIPs: { type: [String] },
    sessionTimeoutMinutes: { type: Number, default: 480 }, // 8 hours

    // Audit
    createdBy: { type: String },
    lastModifiedBy: { type: String },
    lastPasswordChange: { type: Date, default: Date.now },

    // Profile
    profilePhoto: { type: String },
    phone: { type: String },
    timezone: { type: String, default: 'Africa/Lagos' },
    language: { type: String, default: 'en' },

    // Preferences
    dashboardConfig: { type: Schema.Types.Mixed },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      criticalAlerts: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Indexes for performance
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1, isActive: 1 });
adminSchema.index({ lastActiveAt: 1 });
adminSchema.index({ createdAt: -1 });

export default mongoose.model<AdminModelType>('Admin', adminSchema);
