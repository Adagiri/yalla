import mongoose, { Schema, Document } from 'mongoose';

export interface AdminDocument extends Document {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SUPPORT' | 'ANALYST';
  permissions: string[];
  department: string;
  employeeId?: string;

  // Authentication & Security
  isEmailVerified: boolean;
  isMFAEnabled: boolean;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  isActive: boolean;
  accessLevel: number;

  // Password Reset Fields
  resetPasswordCode?: string;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;

  // Profile
  profilePhoto?: string;
  phone?: string;
  timezone: string;
  language: string;

  // Stats
  totalLogins: number;
  totalActions: number;

  // Session Management
  sessionTimeoutMinutes: number;

  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  toSafeObject(): any;
}

const adminSchema = new Schema(
  {
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      required: true,
      enum: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'ANALYST'],
      default: 'ADMIN',
      index: true,
    },
    permissions: [{ type: String }],
    department: { type: String, required: true, trim: true },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // Authentication & Security
    isEmailVerified: { type: Boolean, default: false },
    isMFAEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastActiveAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    accessLevel: { type: Number, default: 1 },

    // Password Reset Fields
    resetPasswordCode: {
      type: String,
      select: false,
      expires: 600, // 10 minutes TTL
    },
    resetPasswordToken: {
      type: String,
      select: false,
      expires: 600, // 10 minutes TTL
    },
    resetPasswordExpiry: {
      type: Date,
      select: false,
    },

    // Profile
    profilePhoto: { type: String },
    phone: { type: String, trim: true },
    timezone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' },

    // Stats
    totalLogins: { type: Number, default: 0 },
    totalActions: { type: Number, default: 0 },

    // Session Management
    sessionTimeoutMinutes: { type: Number, default: 480 }, // 8 hours

    createdBy: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      getters: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.resetPasswordCode;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpiry;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      getters: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.resetPasswordCode;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpiry;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for better query performance
adminSchema.index({ email: 1, isActive: 1 });
adminSchema.index({ role: 1, isActive: 1 });
adminSchema.index({ department: 1, isActive: 1 });
adminSchema.index({ resetPasswordToken: 1, resetPasswordExpiry: 1 });

// Virtual for full name
adminSchema.virtual('fullName').get(function () {
  return `${this.firstname} ${this.lastname}`;
});

// Pre-save middleware to update lastActiveAt for certain operations
adminSchema.pre('save', function (next) {
  if (this.isModified('totalLogins') || this.isModified('totalActions')) {
    this.lastActiveAt = new Date();
  }
  next();
});

// Instance methods
adminSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordCode;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpiry;

  return {
    ...obj,
    id: obj._id,
    fullName: `${obj.firstname} ${obj.lastname}`,
  };
};

// Static methods
adminSchema.statics.findActiveAdmins = function (filter = {}) {
  return this.find({ ...filter, isActive: true }).select('-password');
};

adminSchema.statics.findByRole = function (role: string) {
  return this.find({ role, isActive: true }).select('-password');
};

adminSchema.statics.countByRole = function () {
  return this.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);
};

// Create model
const Admin = mongoose.model<AdminDocument>('Admin', adminSchema);

export default Admin;
