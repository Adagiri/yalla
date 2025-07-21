import mongoose, { Schema, Document } from 'mongoose';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { v4 as uuidv4 } from 'uuid';
import { AccountType, AuthChannelEnum } from '../../constants/general';
import { LocationType, PhoneType } from '../../types/general';
import {
  PAYMENT_MODEL_CONFIG,
  PaymentModel,
  PaymentModelEnum,
} from '../../constants/payment-models';

export interface DriverModelType extends Document {
  _id: string;
  id?: string; // UUID
  firstname: string;
  lastname: string;
  email: string;
  phone: PhoneType;
  password: string;
  oldPasswords: string[];
  accountType: AccountType;
  locationId: string;
  emailVerificationCode: string | null;
  emailVerificationToken: string | null;
  emailVerificationExpiry: Date | null;
  isEmailVerified: boolean;

  phoneVerificationCode: string | null;
  phoneVerificationToken: string | null;
  phoneVerificationExpiry: Date | null;
  isPhoneVerified: boolean;

  resetPasswordCode: string | null;
  resetPasswordToken: string | null;
  resetPasswordExpiry: Date | null;

  authChannels: string[];
  mfaVerificationCode: string | null;
  mfaVerificationToken: string | null;
  mfaVerificationExpiry: Date | null;
  mfaActiveMethod: string | null;
  isMFAEnabled: boolean;

  // profile and driver license info
  profilePhoto: string;
  profilePhotoSet: boolean;
  driverLicenseVerified: boolean;
  personalInfoSet: boolean;
  vehicleInfoSet: boolean;
  driverLicenseFront?: string;
  driverLicenseBack?: string;
  vehicleId?: string;

  // Current location for availability
  currentLocation?: LocationType;

  // Driver status
  isOnline: boolean;
  isAvailable: boolean;
  currentTripId?: string;

  // Statistics
  stats: {
    totalTrips: number;
    totalEarnings: number;
    averageRating: number;
    completionRate: number;
  };

  // Vehicle info already exists
  vehicleInspectionDone: boolean;
  vehicleInsuranceExpiry?: Date;

  deviceTokens: string[];

  walletId?: string;

  // Saved payment methods
  savedCards: Array<{
    authorizationCode: string;
    lastFour: string;
    brand: string;
    bank: string;
    isDefault: boolean;
    createdAt: Date;
  }>;

  // Bank account for cashouts
  bankAccounts: Array<{
    accountNumber: string;
    bankCode: string;
    bankName: string;
    accountName: string;
    isDefault: boolean;
    isVerified: boolean;
    createdAt: Date;
  }>;

  // Payment preferences
  paymentPreferences: {
    autoCashout: boolean;
    autoCashoutThreshold: number; // in kobo
    preferredBankAccount?: string; // account ID
  };

  // Financial tracking
  totalEarningsAllTime: number; // in kobo
  totalCashouts: number; // in kobo
  pendingEarnings: number; // in kobo
  lastCashoutAt?: Date;

  paymentModel: PaymentModel;
  paymentModelHistory: Array<{
    model: PaymentModel;
    changedAt: Date;
    changedBy?: string; // Admin ID who made the change
    reason?: string;
  }>;

  // Commission model specific (only relevant if using COMMISSION model)
  commissionSettings: {
    customRate?: number;
    isActive: boolean;
  };

  // Subscription model specific
  subscriptionSettings: {
    requireActiveSubscription: boolean;
    allowFallbackToCommission: boolean; // If subscription expires, fall back to commission
  };

  earningsBreakdown: {
    subscriptionEarnings: number;
    commissionEarnings: number;
    totalEarnings: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface DriverModelPartialType extends Document {
  id?: string;
  name: string;
}

const driverSchema = new Schema<DriverModelType>(
  {
    _id: { type: String, default: uuidv4 },
    accountType: { type: String, default: AccountType.DRIVER },
    locationId: { type: String },
    vehicleId: { type: String },
    firstname: { type: String },
    lastname: { type: String },
    email: {
      type: String,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      countryCode: String,
      localNumber: String,
      fullPhone: String,
    },
    password: { type: String, select: false },
    oldPasswords: { type: [String], required: true, select: false },

    // Email verification fields
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String },
    emailVerificationToken: { type: String },
    emailVerificationExpiry: { type: Date },

    // Phone verification fields
    isPhoneVerified: { type: Boolean, default: false },
    phoneVerificationCode: { type: String },
    phoneVerificationToken: { type: String },
    phoneVerificationExpiry: { type: Date },

    // Password reset fields
    resetPasswordCode: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpiry: { type: Date },

    // MFA
    isMFAEnabled: { type: Boolean, default: false },
    authChannels: {
      type: [String],
      enum: AuthChannelEnum,
      default: [],
    },
    mfaVerificationCode: { type: String },
    mfaVerificationToken: { type: String },
    mfaVerificationExpiry: { type: Date },
    mfaActiveMethod: { type: String, enum: AuthChannelEnum },

    // New fields for additional driver info
    profilePhoto: { type: String },
    profilePhotoSet: { type: Boolean, default: false },
    driverLicenseVerified: { type: Boolean, default: false },
    personalInfoSet: { type: Boolean, default: false },
    vehicleInfoSet: { type: Boolean, default: false },
    driverLicenseFront: { type: String },
    driverLicenseBack: { type: String },

    currentLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
      heading: { type: Number },
      updatedAt: { type: Date },
    },

    isOnline: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: false },
    currentTripId: { type: String, ref: 'Trip' },

    stats: {
      totalTrips: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
    },

    vehicleInspectionDone: { type: Boolean, default: false },

    vehicleInsuranceExpiry: { type: Date },

    deviceTokens: { type: [String], default: [] },

    walletId: { type: String, ref: 'Wallet' },

    savedCards: [
      {
        authorizationCode: { type: String, required: true },
        lastFour: { type: String, required: true },
        brand: { type: String, required: true },
        bank: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    bankAccounts: [
      {
        accountNumber: { type: String, required: true },
        bankCode: { type: String, required: true },
        bankName: { type: String, required: true },
        accountName: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        isVerified: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    paymentPreferences: {
      autoCashout: { type: Boolean, default: false },
      autoCashoutThreshold: { type: Number, default: 5000000 }, // ₦50,000
      preferredBankAccount: { type: String },
    },

    totalEarningsAllTime: { type: Number, default: 0 },
    totalCashouts: { type: Number, default: 0 },
    pendingEarnings: { type: Number, default: 0 },
    lastCashoutAt: { type: Date },

    paymentModel: {
      type: String,
      enum: PaymentModelEnum,
      default: PAYMENT_MODEL_CONFIG.DEFAULT_MODEL,
    },

    paymentModelHistory: [
      {
        model: {
          type: String,
          enum: PaymentModelEnum,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: String, // Admin ID
        },
        reason: {
          type: String,
        },
      },
    ],

    commissionSettings: {
      customRate: {
        type: Number,
        min: 0,
        max: 1,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },

    subscriptionSettings: {
      requireActiveSubscription: {
        type: Boolean,
        default: PAYMENT_MODEL_CONFIG.SUBSCRIPTION_ENFORCEMENT,
      },
      allowFallbackToCommission: {
        type: Boolean,
        default: false,
      },
    },

    earningsBreakdown: {
      subscriptionEarnings: {
        type: Number,
        default: 0,
        get: (value: number) => Math.round(value / 100), // Convert from kobo
        set: (value: number) => Math.round(value * 100), // Convert to kobo
      },
      commissionEarnings: {
        type: Number,
        default: 0,
        get: (value: number) => Math.round(value / 100),
        set: (value: number) => Math.round(value * 100),
      },
      totalEarnings: {
        type: Number,
        default: 0,
        get: (value: number) => Math.round(value / 100),
        set: (value: number) => Math.round(value * 100),
      },
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

driverSchema.virtual('location', {
  ref: 'Location',
  localField: 'locationId',
  foreignField: '_id',
  justOne: true,
});

driverSchema.virtual('vehicle', {
  ref: 'Vehicle',
  localField: 'vehicleId',
  foreignField: '_id',
  justOne: true,
});

driverSchema.pre(
  /^find/,
  function (this: mongoose.Query<any, DriverModelType>, next) {
    this.populate('location vehicle');
    next();
  }
);

driverSchema.index({ currentLocation: '2dsphere' });
driverSchema.index({ isOnline: 1, isAvailable: 1 });
driverSchema.index({ locationId: 1 });

driverSchema.index({ walletId: 1 });
driverSchema.index({ 'bankAccounts.accountNumber': 1 });
driverSchema.index({ 'savedCards.authorizationCode': 1 });
driverSchema.index({ lastCashoutAt: -1 });

driverSchema.pre<DriverModelType>('save', function (next) {
  if (this.phone && this.phone.fullPhone) {
    const phoneNumber = parsePhoneNumberFromString(this.phone.fullPhone);
    if (!phoneNumber || !phoneNumber.isValid()) {
      return next(new Error('Invalid phone number format'));
    }
    // Normalize and update phone fields
    this.phone.countryCode = '+' + phoneNumber.countryCallingCode;
    this.phone.localNumber = phoneNumber.nationalNumber;
    this.phone.fullPhone = phoneNumber.format('E.164');
  }
  next();
});

const Driver = mongoose.model<DriverModelType>('Driver', driverSchema);

export default Driver;
