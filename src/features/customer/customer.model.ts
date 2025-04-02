import mongoose, { Schema, Document } from 'mongoose';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { v4 as uuidv4 } from 'uuid';
import { AccountType, AuthChannelEnum } from '../../constants/general';

export interface CustomerModelType extends Document {
  id?: string; // UUID
  firstname: string;
  lastname: string;
  email: string;
  phone: {
    countryCode: string; // E.g., "+1"
    localNumber: string; // E.g., "4155552671"
    fullPhone: string; // E.164 format: "+14155552671"
  };
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

  // profile and customer license info
  profilePhoto: string;
  profilePhotoSet: boolean;
  personalInfoSet: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerModelPartialType extends Document {
  id?: string;
  name: string;
}

const customerSchema = new Schema<CustomerModelType>(
  {
    _id: { type: String, default: uuidv4 },
    accountType: { type: String, default: AccountType.DRIVER },
    locationId: { type: String },
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

    // New fields for additional customer info
    profilePhoto: { type: String },
    profilePhotoSet: { type: Boolean, default: false },
    personalInfoSet: { type: Boolean, default: false },

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

customerSchema.virtual('location', {
  ref: 'Location',
  localField: 'locationId',
  foreignField: '_id',
  justOne: true,
});

customerSchema.virtual('vehicle', {
  ref: 'Vehicle',
  localField: 'vehicleId',
  foreignField: '_id',
  justOne: true,
});

customerSchema.pre(
  /^find/,
  function (this: mongoose.Query<any, CustomerModelType>, next) {
    this.populate('location vehicle');
    next();
  }
);

customerSchema.index({ locationId: 1 });

customerSchema.pre<CustomerModelType>('save', function (next) {
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

const Customer = mongoose.model<CustomerModelType>('Customer', customerSchema);

export default Customer;
