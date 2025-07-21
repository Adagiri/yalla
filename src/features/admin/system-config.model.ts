import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface SystemConfigDocument extends Document {
  _id: string;

  category: string; // e.g., 'pricing', 'features', 'limits', 'integrations'
  key: string; // e.g., 'base_fare', 'max_drivers_per_trip', 'paystack_enabled'
  value: any; // The actual configuration value

  // Metadata
  description?: string;
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  isPublic: boolean; // Can be accessed by public APIs
  isRequired: boolean; // System cannot function without this config

  // Validation
  validationRules?: {
    min?: number;
    max?: number;
    allowedValues?: any[];
    regex?: string;
  };

  // Access control
  requiredPermission?: string; // Permission needed to modify

  // Audit trail
  lastModifiedBy: string;
  lastModifiedAt: Date;
  version: number;

  // History tracking
  previousValues?: Array<{
    value: any;
    modifiedBy: string;
    modifiedAt: Date;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const systemConfigSchema = new Schema<SystemConfigDocument>(
  {
    _id: { type: String, default: uuidv4 },

    // Core configuration
    category: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },

    // Metadata
    description: { type: String },
    dataType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'object', 'array'],
      required: true,
    },
    isPublic: { type: Boolean, default: false, index: true },
    isRequired: { type: Boolean, default: false },

    // Validation rules
    validationRules: {
      min: { type: Number },
      max: { type: Number },
      allowedValues: { type: [Schema.Types.Mixed] },
      regex: { type: String },
    },

    // Access control
    requiredPermission: { type: String },

    // Audit trail
    lastModifiedBy: { type: String, required: true },
    lastModifiedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },

    // History tracking
    previousValues: [
      {
        value: { type: Schema.Types.Mixed },
        modifiedBy: { type: String },
        modifiedAt: { type: Date },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for unique category + key combination
systemConfigSchema.index({ category: 1, key: 1 }, { unique: true });

// Index for efficient querying
systemConfigSchema.index({ category: 1, isPublic: 1 });
systemConfigSchema.index({ lastModifiedAt: -1 });

// Pre-save middleware to track changes
systemConfigSchema.pre('save', function (next) {
  if (this.isModified('value') && !this.isNew) {
    // Store previous value in history
    if (!this.previousValues) {
      this.previousValues = [];
    }

    this.previousValues.push({
      value: this.get('value'), // Get the original value before change
      modifiedBy: this.lastModifiedBy,
      modifiedAt: this.lastModifiedAt,
    });

    // Keep only last 10 changes
    if (this.previousValues.length > 10) {
      this.previousValues = this.previousValues.slice(-10);
    }

    // Increment version
    this.version += 1;
    this.lastModifiedAt = new Date();
  }

  next();
});

// Static method to get config value with caching
systemConfigSchema.statics.getConfigValue = async function (
  category: string,
  key: string,
  defaultValue?: any
) {
  try {
    const config = await this.findOne({ category, key }).lean();
    return config ? config.value : defaultValue;
  } catch (error) {
    console.error(`Error getting config ${category}.${key}:`, error);
    return defaultValue;
  }
};

// Static method to set config value
systemConfigSchema.statics.setConfigValue = async function (
  category: string,
  key: string,
  value: any,
  modifiedBy: string,
  options?: {
    description?: string;
    dataType?: string;
    isPublic?: boolean;
    isRequired?: boolean;
  }
) {
  try {
    const updateData = {
      value,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date(),
      ...(options?.description && { description: options.description }),
      ...(options?.dataType && { dataType: options.dataType }),
      ...(options?.isPublic !== undefined && { isPublic: options.isPublic }),
      ...(options?.isRequired !== undefined && {
        isRequired: options.isRequired,
      }),
    };

    return await this.findOneAndUpdate({ category, key }, updateData, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  } catch (error) {
    console.error(`Error setting config ${category}.${key}:`, error);
    throw error;
  }
};

// Default system configurations
const DEFAULT_CONFIGS = [
  // Pricing configurations
  {
    category: 'pricing',
    key: 'base_fare',
    value: 500,
    dataType: 'number',
    description: 'Base fare in kobo',
    isPublic: true,
  },
  {
    category: 'pricing',
    key: 'price_per_km',
    value: 100,
    dataType: 'number',
    description: 'Price per kilometer in kobo',
    isPublic: true,
  },
  {
    category: 'pricing',
    key: 'price_per_minute',
    value: 20,
    dataType: 'number',
    description: 'Price per minute in kobo',
    isPublic: true,
  },
  {
    category: 'pricing',
    key: 'surge_multiplier_max',
    value: 3.0,
    dataType: 'number',
    description: 'Maximum surge pricing multiplier',
  },

  // Trip configurations
  {
    category: 'trip',
    key: 'max_search_radius_km',
    value: 10,
    dataType: 'number',
    description: 'Maximum radius to search for drivers (km)',
  },
  {
    category: 'trip',
    key: 'driver_search_timeout_seconds',
    value: 30,
    dataType: 'number',
    description: 'Timeout for driver search',
  },
  {
    category: 'trip',
    key: 'max_drivers_per_request',
    value: 5,
    dataType: 'number',
    description: 'Maximum drivers to notify per trip request',
  },
  {
    category: 'trip',
    key: 'cancellation_fee_minutes',
    value: 5,
    dataType: 'number',
    description: 'Minutes after which cancellation fee applies',
  },

  // Feature flags
  {
    category: 'features',
    key: 'subscription_enabled',
    value: true,
    dataType: 'boolean',
    description: 'Enable subscription payment model',
    isPublic: true,
  },
  {
    category: 'features',
    key: 'commission_enabled',
    value: true,
    dataType: 'boolean',
    description: 'Enable commission payment model',
    isPublic: true,
  },
  {
    category: 'features',
    key: 'rating_required',
    value: true,
    dataType: 'boolean',
    description: 'Require ratings after trips',
    isPublic: true,
  },
  {
    category: 'features',
    key: 'real_time_tracking',
    value: true,
    dataType: 'boolean',
    description: 'Enable real-time trip tracking',
    isPublic: true,
  },

  // Limits
  {
    category: 'limits',
    key: 'max_trip_duration_hours',
    value: 24,
    dataType: 'number',
    description: 'Maximum trip duration in hours',
  },
  {
    category: 'limits',
    key: 'max_daily_trips_per_driver',
    value: 50,
    dataType: 'number',
    description: 'Maximum trips per driver per day',
  },
  {
    category: 'limits',
    key: 'min_driver_rating',
    value: 3.0,
    dataType: 'number',
    description: 'Minimum driver rating to receive trips',
  },

  // Payment configurations
  {
    category: 'payment',
    key: 'paystack_enabled',
    value: true,
    dataType: 'boolean',
    description: 'Enable Paystack payments',
  },
  {
    category: 'payment',
    key: 'cash_enabled',
    value: true,
    dataType: 'boolean',
    description: 'Enable cash payments',
    isPublic: true,
  },
  {
    category: 'payment',
    key: 'wallet_enabled',
    value: true,
    dataType: 'boolean',
    description: 'Enable wallet payments',
    isPublic: true,
  },

  // Notification settings
  {
    category: 'notifications',
    key: 'sms_enabled',
    value: true,
    dataType: 'boolean',
    description: 'Enable SMS notifications',
  },
  {
    category: 'notifications',
    key: 'push_enabled',
    value: true,
    dataType: 'boolean',
    description: 'Enable push notifications',
  },
  {
    category: 'notifications',
    key: 'email_enabled',
    value: true,
    dataType: 'boolean',
    description: 'Enable email notifications',
  },
];

// Initialize default configurations
systemConfigSchema.statics.initializeDefaults = async function (
  adminId: string = 'system'
) {
  try {
    for (const config of DEFAULT_CONFIGS) {
      const exists = await this.findOne({
        category: config.category,
        key: config.key,
      });

      if (!exists) {
        await this.create({
          ...config,
          lastModifiedBy: adminId,
        });
      }
    }
    console.log('✅ Default system configurations initialized');
  } catch (error) {
    console.error('❌ Error initializing default configurations:', error);
  }
};

export default mongoose.model<SystemConfigDocument>(
  'SystemConfig',
  systemConfigSchema
);
