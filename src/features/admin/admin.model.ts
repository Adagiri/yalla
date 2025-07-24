import mongoose, { Schema, Document } from 'mongoose';

export interface AdminDocument extends Document {
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

  // Profile
  profilePhoto?: string;
  phone?: string;
  timezone: string;
  language: string;

  // Stats
  totalLogins: number;
  totalActions: number;

  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  toSafeObject(): any;
}

const adminSchema = new Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      required: true,
      enum: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'ANALYST'],
      default: 'ADMIN',
    },
    permissions: [{ type: String }],
    department: { type: String, required: true },
    employeeId: { type: String, unique: true, sparse: true },

    isEmailVerified: { type: Boolean, default: false },
    isMFAEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastActiveAt: { type: Date },
    isActive: { type: Boolean, default: true },
    accessLevel: { type: Number, default: 1 },

    profilePhoto: { type: String },
    phone: { type: String },
    timezone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' },

    totalLogins: { type: Number, default: 0 },
    totalActions: { type: Number, default: 0 },

    createdBy: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      getters: true,
      transform: function (doc, ret) {
        delete ret.password; // Safe to delete here
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      getters: true,
      transform: function (doc, ret) {
        delete ret.password; // Safe to delete here
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });

// Methods
adminSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return {
    ...obj,
    id: obj._id,
  };
};

export default mongoose.model<AdminDocument>('Admin', adminSchema);
