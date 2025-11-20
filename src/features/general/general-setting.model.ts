import mongoose, { Schema, Document } from 'mongoose';
const validator = require('validator');

export interface IGeneralSetting extends Document {
  applicationName: string;
  supportPhone: string;
  defaultCurrency: 'NGN' | 'USD';
  supportEmail: string;
  timeZone: 'WAT' | 'UTC';
  defaultLanguage: 'en' | 'ha' | 'ig' | 'yo';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GeneralSettingSchema = new Schema<IGeneralSetting>(
  {
    applicationName: {
      type: String,
      required: [true, 'Application name is required'],
      trim: true,
      minlength: [2, 'Application name must be at least 2 characters'],
      maxlength: [50, 'Application name cannot exceed 100 characters'],
    },
    supportPhone: {
      type: String,
      required: [true, 'Support phone is required'],
      trim: true,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number'],
    },
    defaultCurrency: {
      type: String,
      required: [true, 'Default currency is required'],
      enum: {
        values: ['NGN', 'USD'],
        message: 'Currency must be either NGN or USD',
      },
      default: 'NGN',
    },
    supportEmail: {
      type: String,
      required: [true, 'Support email is required'],
      trim: true,
      lowercase: true,
      //   match: [
      //     /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      //     'Please enter a valid email address',
      //   ],
      validate: [validator.isEmail, 'Please enter a valid email address'],
    },
    timeZone: {
      type: String,
      required: [true, 'Time zone is required'],
      enum: {
        values: ['WAT', 'UTC'],
        message: 'Time zone must be either WAT or UTC',
      },
      default: 'WAT',
    },
    defaultLanguage: {
      type: String,
      required: [true, 'Default language is required'],
      enum: {
        values: ['en', 'ha', 'ig', 'yo'],
        message: 'Language must be English, Hausa, Igbo, or Yoruba',
      },
      default: 'en',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// create a compound unique index for active settings
GeneralSettingSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

// pre-save middleware to ensure only one active setting
GeneralSettingSchema.pre('save', async function (next) {
  if (this.isActive) {
    try {
      // Deactivate all other settings
      await mongoose
        .model('GeneralSetting')
        .updateMany(
          { _id: { $ne: this._id }, isActive: true },
          { $set: { isActive: false } }
        );
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

export default mongoose.model<IGeneralSetting>(
  'GeneralSetting',
  GeneralSettingSchema
);
